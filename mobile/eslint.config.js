// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // server/ and admin/ are separate projects with its own dependencies and lint config.
    ignores: ["dist/*", "dist-web/**", "tools/fidelity/out/**"],
  }
]);
