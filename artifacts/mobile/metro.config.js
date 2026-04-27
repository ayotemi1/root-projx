const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// On web, stub out @stripe/stripe-react-native which uses native-only modules
// that are incompatible with the web bundler. The donate screen is native-only.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    (moduleName === "@stripe/stripe-react-native" ||
      moduleName.startsWith("@stripe/stripe-react-native/"))
  ) {
    return { type: "empty" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
