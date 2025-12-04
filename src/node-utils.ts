import { execSync } from "child_process";
import crypto from "crypto";
import fs, { createReadStream, createWriteStream } from "fs";
import path from "path";
import { once, Readable } from "stream";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";
import zlib from "zlib";

import nv from "@pkgjs/nv";
import tar from "tar";
import { request as fetch } from "undici";

import { Logger } from "./logger";

export class NodeUtils {
  // Download and unpack a tarball containing the code for a specific Node.js version.
  async getNodeSourceForVersion(
    range: string,
    dir: string,
    logger: Logger,
    platform: string = "linux",
    retries = 2
  ): Promise<string> {
    logger.stepStarting(`Looking for Node.js version matching ${JSON.stringify(range)}`);

    let inputIsFileUrl = false;
    try {
      inputIsFileUrl = new URL(range).protocol === "file:";
    } catch {
      /* not a valid URL */
    }

    if (inputIsFileUrl) {
      logger.stepStarting(`Extracting tarball from ${range} to ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
      await pipeline(
        createReadStream(fileURLToPath(range)),
        zlib.createGunzip(),
        tar.x({
          cwd: dir,
        })
      );
      logger.stepCompleted();
      const filesInDir = fs.readdirSync(dir, { withFileTypes: true });
      const dirsInDir = filesInDir.filter((f) => f.isDirectory());
      if (dirsInDir.length !== 1) {
        throw new Error("Node.js tarballs should contain exactly one directory");
      }
      return path.join(dir, dirsInDir[0].name);
    }

    let releaseBaseUrl: string;
    let version: string;
    if (range.match(/-nightly\d+/)) {
      version = range.startsWith("v") ? range : `v${range}`;
      releaseBaseUrl = `https://nodejs.org/download/nightly/${version}`;
    } else {
      const ver = (await nv(range)).pop();
      if (!ver) {
        throw new Error(`No node version found for ${range}`);
      }
      version = `v${ver.version}`;
      releaseBaseUrl = `https://nodejs.org/download/release/${version}`;
    }

    const nodePlatform = platform === "win32" ? "win" : platform;
    const arch = "x64";
    const ext = platform === "win32" ? "zip" : "tar.gz";
    const cachedName = `node-${version}-${nodePlatform}-${arch}`;
    const tarballName = `${cachedName}.${ext}`;
    const cachedTarballPath = path.join(dir, tarballName);
    const cachedNodePath = path.join(dir, cachedName, platform === "win32" ? "node.exe" : path.join("bin", "node"));

    let hasCachedTarball = false;
    try {
      hasCachedTarball = fs.statSync(cachedTarballPath).size > 0;
    } catch {}
    if (hasCachedTarball) {
      const shaSumsUrl = `${releaseBaseUrl}/SHASUMS256.txt`;
      logger.stepStarting(`Verifying existing tarball via ${shaSumsUrl}`);
      const [expectedSha, realSha] = await Promise.all([
        (async () => {
          try {
            const shaSums = await fetch(shaSumsUrl);
            if (shaSums.statusCode !== 200) return;
            const text = await shaSums.body.text();
            for (const line of text.split("\n")) {
              if (line.trim().endsWith(tarballName)) {
                return line.match(/^([0-9a-fA-F]+)\b/)?.[0];
              }
            }
          } catch {}
          return null;
        })(),
        (async () => {
          const hash = crypto.createHash("sha256");
          await pipeline(createReadStream(cachedTarballPath), hash);
          return hash.digest("hex");
        })(),
      ]);
      if (expectedSha === realSha) {
        logger.stepStarting("Unpacking existing tarball");
      } else {
        logger.stepFailed(new Error(`SHA256 mismatch: got ${realSha}, expected ${expectedSha}`));
        hasCachedTarball = false;
      }
    }

    let tarballStream: Readable | null;
    let tarballWritePromise: Promise<unknown> | undefined;
    if (hasCachedTarball) {
      const hasNodePath = fs.statSync(cachedNodePath).size > 0;

      if (hasNodePath) {
        return cachedNodePath;
      }
      tarballStream = createReadStream(cachedTarballPath);
    } else {
      const url = `${releaseBaseUrl}/${tarballName}`;
      logger.stepStarting(`Downloading from ${url}`);

      const tarball = await fetch(url);

      if (tarball.statusCode !== 200) {
        throw new Error(`Could not download Node.js source tarball: ${tarball.statusCode}`);
      }

      logger.stepStarting(`Unpacking tarball to ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
      const contentLength = +(tarball.headers["content-length"] ?? 0);
      if (contentLength) {
        logger.startProgress(contentLength);
        let downloaded = 0;
        tarball.body?.on("data", (chunk) => {
          downloaded += chunk.length;
          logger.doProgress(downloaded);
        });
      }

      tarballStream = tarball.body;
      // It is important that this happens in the same tick as the streaming
      // unpack below in order not to lose any data.
      tarballWritePromise = pipeline(tarballStream, createWriteStream(cachedTarballPath));
    }

    // Streaming unpack or unzip.
    try {
      if (ext === "zip") {
        if (tarballWritePromise) await tarballWritePromise;
        logger.stepStarting(`Unzipping to ${dir}`);
        execSync(`unzip -q -o "${cachedTarballPath}" -d "${dir}"`);
      } else {
        await Promise.all([
          pipeline(
            tarballStream!,
            zlib.createGunzip(),
            tar.x({
              cwd: dir,
            })
          ),
          tarballWritePromise,
        ]);
      }
    } catch (err) {
      if (retries > 0) {
        logger.stepFailed(err);
        logger.stepStarting("Re-trying");
        return await this.getNodeSourceForVersion(range, dir, logger, platform, retries - 1);
      }
      throw err;
    }

    logger.stepCompleted();

    return cachedNodePath;
  }
}
