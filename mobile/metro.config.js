const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// shared/ lives one level up (the server and the admin site use it too). It has no node_modules of its own, so its
// files are compiled with this project's packages.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// react-native-youtube-iframe's web entry requires an uninstalled package; stub it on web only.
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-web-webview") {
    return { type: "sourceFile", filePath: path.join(__dirname, "lib/web-stubs/empty.js") };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
// module.exports = config;
