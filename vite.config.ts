import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  server: {
    fs: { // TODO temporary, to allow serving locally built reactively
      allow: [".."],
    }
  }
});
