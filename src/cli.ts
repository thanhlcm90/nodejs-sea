#!/usr/bin/env node

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

import { Command, Option, runExit, UsageError } from "clipanion";
import { rimraf } from "rimraf";

import { LoggerImpl } from "./logger";
import { NodeUtils } from "./node-utils";

const currentWorkingDirectory = process.cwd();

const esbuild = require("esbuild");

class PackCommand extends Command {
  input = Option.String(`-s,--sea-config`, {
    description: `Path of the sea config file. Default is sea/config.json`,
  });
  nodeVersion = Option.String(`-n,--node-version`, {
    description: `Node.js version or semver version range. Default is 22.11.0`,
  });
  clean = Option.String(`-c,--clean`, {
    description: `Node.js version or semver version range. Default is true`,
  });

  /**
   * run command
   *
   * @param command
   * @returns
   */
  async execCommand(command: string, args: string[]) {
    const child = spawn(command, args, {
      cwd: currentWorkingDirectory,
      shell: true,
      stdio: `inherit`,
    });

    const result = await new Promise<number>((resolve, reject) => {
      child.on(`close`, (code, signal) => resolve(code ?? 1));
    });

    if (result !== 0) throw new UsageError(`Command failed`);
  }

  async execute() {
    const logger = new LoggerImpl();
    const nodeUtils = new NodeUtils();
    const tmpdir = path.join(currentWorkingDirectory, "node_modules/.cache/nodejs-sea");
    const configFilePath = this.input ?? "sea/config.json";
    const configContent = fs.readFileSync(configFilePath).toString();
    const nodeVersion = this.nodeVersion ?? "22.11.0";
    let config: any;
    try {
      config = JSON.parse(configContent);
    } catch (err) {}

    if (!config.main || !config.output) {
      throw new UsageError("Sea config is not correct");
    }

    const outputPath = config.output.split("/").slice(0, -1).join("/");
    const copyFiles = config.copyFiles ?? [];
    const esbuildConfig = config.esbuild;
    const nodeSourcePath = await nodeUtils.getNodeSourceForVersion(nodeVersion, tmpdir, logger);
    const appPath = path.join(outputPath, "app");

    logger.stepStarting("Cleaning dist directory");
    await rimraf(outputPath, { glob: false });
    fs.mkdirSync(outputPath, { recursive: true });
    logger.stepCompleted();

    if (Array.isArray(copyFiles) && copyFiles.length > 0) {
      logger.stepStarting("Copy files");
      for (const f of copyFiles) {
        await this.execCommand("cp", ["-rf", f, `${outputPath}/`]);
      }
      logger.stepCompleted();
    }

    if (esbuildConfig) {
      logger.stepStarting("Run esbuild");
      await esbuild.build(esbuildConfig);
      logger.stepCompleted();
    }

    logger.stepStarting("Inject to NodeJS Single Execute Application");
    await this.execCommand("node", ["--experimental-sea-config", configFilePath]);
    await this.execCommand("cp", [nodeSourcePath, appPath]);
    await this.execCommand("npx", [
      "postject",
      appPath,
      "NODE_SEA_BLOB",
      config.output,
      "--sentinel-fuse",
      "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ]);
    logger.stepCompleted();

    // clear temp file
    const clean = this.clean ?? true;
    if (clean) {
      logger.stepStarting("Remove generated files");
      const cleanFiles = [config.output];
      if (esbuildConfig?.outfile) {
        cleanFiles.push(path.resolve(currentWorkingDirectory, esbuildConfig.outfile));
      }
      await this.execCommand("rm", cleanFiles);
      logger.stepCompleted();
    }
  }
}

runExit(
  {
    binaryLabel: ``,
  },
  [PackCommand]
);
