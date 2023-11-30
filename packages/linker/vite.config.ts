import { defineConfig } from "vite";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from 'vite-plugin-dts'


export default defineConfig({
  plugins: [tsconfigPaths(), dts()],
  build: {
    lib: {
      entry: [
        resolve(__dirname, "src/index.ts"),
        resolve(__dirname, "src/ReplaceTemplate.ts"),
      ],
    },
    sourcemap: true,
  },
});
