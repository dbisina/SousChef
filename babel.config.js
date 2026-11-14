module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          // zustand's ESM build uses `import.meta.env`; Metro web serves classic scripts, so
          // `import.meta` is a SyntaxError there. Rewrite it for web only (native is untouched).
          web: { unstable_transformImportMeta: true },
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
    ],
  };
};
