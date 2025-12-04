<p align="center">
<a href="https://github.com/thanhlcm90/nodejs-sea" target="blank"><img src="https://nodejs.org/static/logos/nodejsDark.svg" width="120" alt="NodeJS Logo" /></a>
</p>
<h1 align="center">NestJS SEA</h1>

<p align="center">
  CLI for NodeJS single executable applications.
  <p align="center">
    <a href="https://www.npmjs.com/package/nodejs-sea" target="_blank"><img alt="npm version" src="https://img.shields.io/npm/v/nodejs-sea" /></a>
    <a href="https://www.npmjs.com/package/nodejs-sea" target="_blank"><img alt="NPM" src="https://img.shields.io/npm/l/nodejs-sea" /></a>
    <a href="https://www.npmjs.com/package/nodejs-sea" target="_blank"><img alt="npm downloads" src="https://img.shields.io/npm/dm/nodejs-sea" /></a>
    <a href="https://coveralls.io/github/thanhlcm90/nodejs-sea?branch=main" target="_blank"><img alt="coverage" src="https://coveralls.io/repos/github/thanhlcm90/nodejs-sea/badge.svg?branch=main" /></a>
  </p>
</p>

## Table of Contents

- [Description](#description)
- [API document](#api-document)
- [Installation](#installation)
- [Example](#example)
- [CLI usage](#cli-usage)
- [Contact and Feedback](#contact-and-feedback)
- [License](#license)

## Description

This feature allows the distribution of a Node.js application conveniently to a system that does not have Node.js installed.

Node.js supports the creation of <a href="https://nodejs.org/api/single-executable-applications.html" target="blank">single executable applications</a> by allowing the injection of a blob prepared by Node.js, which can contain a bundled script, into the node binary. During start up, the program checks if anything has been injected. If the blob is found, it executes the script in the blob. Otherwise Node.js operates as it normally does.

The single executable application feature currently only supports running a single embedded script using the CommonJS module system.

Users can create a single executable application from their bundled script with the node binary itself and any tool which can inject resources into the binary.

**To use this CLI, you must use Node.js 18+.**

## API document

You can visit the full API documents <a href="https://thanhlcm90.github.io/nodejs-sea">in here</a>

## Installation

You can install the library using npm:

```
npm install nodejs-sea
```

With yarn

```
yarn add nodejs-sea
```

## CLI usage

Run build script with `npx`

```
npx nodejs-sea sea
```

```sh
Options:
      --version         Show version number             [boolean]
  -s, --sea-config      Path of the sea config file     [string] [default: "sea/config.json"]
  -n, --node-version    Node.js version                 [string] [default: "*"]
  -c, --clean           Remove generated files          [boolean] [default: true]
  -p, --platform        Target platform (linux, darwin, win32) [string] [default: current platform]
      --help            Show help                       [boolean]
  -e, --env-file        Path to .env file  [string] [default: .env]
```

## Example

To build the single executable applications from source, please create the folder `sea`, and put the `config.json` file

```json
{
  "main": "sea/dist/server-out.js",
  "output": "sea/dist/viactapp.blob"
}
```

If you want copy some files from your source to your build output, put them into `copyFiles`

```json
{
  "main": "sea/dist/server-out.js",
  "output": "sea/dist/viactapp.blob",
  "copyFiles": ["src/config.json", ".env"]
}
```

If you want run <a href="https://esbuild.github.io/">esbuild</a> before, put esbuild config into `esbuild`

```json
{
  "main": "sea/dist/server-out.js",
  "output": "sea/dist/app.blob",
  "esbuild": {
    "entryPoints": ["main.js"],
    "bundle": true,
    "outfile": "sea/dist/server-out.js",
    "platform": "node",
    "external": ["@aws-sdk/client-s3", "hbs"],
    "packages": "bundle"
  }
}
```

## Contact and Feedback

If you have any ideas, comments, or questions, don't hesitate to contact me

Best regards,

Daniel Le

## License

This library is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
