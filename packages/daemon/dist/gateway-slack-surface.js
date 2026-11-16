// S10 — the narrow @openrig-local/daemon/gateway-slack surface: exactly what the CLI's surviving
// config verbs (`rig slack setup/status/verify/channel-map`) consume after the relay cutover re-homed the
// slack modules into the daemon. Same dep-rail pattern as gateway-protocol / human-registry:
// the CLI lazy-imports this at invocation; nothing else is exported.
export { loadConfig, saveConfig, configPathFor, staticReadiness, DEFAULT_CONFIG, } from "./domain/gateway/slack/config.js";
export { resolveSecret, checkEnvFilePermissions } from "./domain/gateway/slack/secrets.js";
export { mappedChannels, validateChannelMap, setChannelMapEntry, removeChannelMapEntry, } from "./domain/gateway/slack/channel-map.js";
export { buildSlackAppManifest, CANONICAL_MANIFEST_SOURCES, } from "./domain/gateway/slack/manifest.js";
export { FEATURE_SCOPES, BASELINE_REQUIRED_SCOPES } from "./domain/gateway/slack/capabilities.js";
export { runChannelOperation, channelStateDigest } from "./domain/gateway/channel-operations.js";
export { verifyScopes, verifyChannelMembership, } from "./domain/gateway/slack/slack-api.js";
//# sourceMappingURL=gateway-slack-surface.js.map