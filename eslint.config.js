// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // eslint-config-expo 58 enables the React Compiler-based react-hooks rules as errors.
    // The codebase predates them; surface as warnings instead of blocking lint.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  {
    // False positive: AndroidImportance is re-exported via `export *` and resolves in tsc.
    files: ["services/notificationService.ts"],
    rules: { "import/namespace": "off" },
  },
]);
