const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

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
