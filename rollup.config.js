import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import ts from "@rollup/plugin-typescript";
import shebang from "rollup-plugin-preserve-shebang";
import { terser } from "rollup-plugin-terser";

// eslint-disable-next-line arca/no-default-export
export default [
  {
    input: `./src/cli.ts`,
    output: [
      {
        dir: `lib`,
        entryFileNames: `[name].mjs`,
        format: `es`,
      },
      {
        dir: `lib`,
        entryFileNames: `[name].js`,
        format: `cjs`,
      },
    ],
    plugins: [
      shebang(),
      ts({
        tsconfig: `tsconfig.build.json`,
      }),
    ],
  },
];
