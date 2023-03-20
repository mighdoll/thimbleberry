import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: undefined as unknown as "react",
      bundler: "vite",
      viteConfig: {
        plugins: [tsconfigPaths()],
      },
    },
    setupNodeEvents(on: Cypress.PluginEvents) {
      on("before:browser:launch", (browser: Cypress.Browser, launchOptions) => {
        if (browser.family === "chromium") {
          launchOptions.args.push(
            "--disable-dawn-features=disallow_unsafe_apis"
          );
        }
        return launchOptions;
      });
    },
    supportFile: false,
    // experimentalRunAllSpecs: true,
  },
});
