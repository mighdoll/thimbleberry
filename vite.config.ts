import { defineConfig } from "vite";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import TreeShakableDecorators from "vite-plugin-tree-shakable-decorators";

export default defineConfig({
  plugins: [tsconfigPaths(), TreeShakableDecorators()],
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/thimbleberry.ts"),
      name: "Thimbleberry",
      // the proper extensions will be added
      fileName: "thimbleberry",
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      // external: ["berry-pretty"],
    },
  },
});
