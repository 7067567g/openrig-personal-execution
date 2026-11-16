// Slice-11 slack-connector — first-class connector config (item 5 + T1075).
//
// Config is a first-class JSON file (NOT env-only): inbound destination,
// watched channel, OWNER thresholds, source label, required scopes, and POINTERS to
// secrets (never secret VALUES — those live in the 0600 env file / env vars).
// An unset/partial config yields an HONEST unconfigured state (no throw, no
// silent nothing) so `rig slack status` can tell the operator exactly what's left.
import fs from "node:fs";
import path from "node:path";
import { getOpenRigHome } from "../../../openrig-compat.js";
import { OWNER_NOTIFICATION_LEVELS } from "../../queue-transition-log.js";
import { BASELINE_REQUIRED_SCOPES } from "./capabilities.js";
import { unsupportedChannelMapFields, validateChannelMap } from "./channel-map.js";
export const DEFAULT_CONFIG = {
    enabled: false,
    inboundDestination: "operator-agent@kernel",
    outboundDestinations: [],
    sourceLabel: "openrig",
    channel: null,
    requiredScopes: [...BASELINE_REQUIRED_SCOPES],
    secretsEnvFile: null,
    queueUrl: null,
    minimumLevelThatPosts: "NOTICE",
    minimumLevelThatInterrupts: "ALERT",
};
function validateLevel(field, value) {
    if (!OWNER_NOTIFICATION_LEVELS.includes(value)) {
        throw new Error(`${field} must be one of ${OWNER_NOTIFICATION_LEVELS.join(", ")} (got ${String(value)})`);
    }
}
/** `reading`: a channel-map entry field written by a newer OpenRig is ignored (and reported by
 *  staticReadiness and the gateway log) rather than failing the connector after a downgrade. */
function validateConfig(cfg, opts = {}) {
    validateLevel("minimumLevelThatPosts", cfg.minimumLevelThatPosts);
    validateLevel("minimumLevelThatInterrupts", cfg.minimumLevelThatInterrupts);
    validateChannelMap(cfg, { allowUnknownFields: opts.reading });
}
export function configPathFor(home) {
    return path.join(home ?? getOpenRigHome(), "slack-connector.json");
}
export function loadConfig(home) {
    const p = configPathFor(home);
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(p, "utf8"));
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
    const { alertTag: _retiredAlertTag, ...supported } = raw;
    const cfg = { ...DEFAULT_CONFIG, ...supported };
    validateConfig(cfg, { reading: true });
    return cfg;
}
export function saveConfig(cfg, home) {
    validateConfig(cfg);
    const p = configPathFor(home);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
    return p;
}
export function configFileExists(home) {
    return fs.existsSync(configPathFor(home));
}
/**
 * HONEST unconfigured state (item 5): a static (no-network) readiness checklist
 * from config + secret RESOLVABILITY (not values). Live scope/membership checks
 * are `rig slack verify`. Never throws; reports what's missing.
 *
 * S10: outbound posts via the Web API (`chat.postMessage`) on the in-daemon subsystem — the
 * bot token + channel are the outbound gate now; the incoming webhook retired with the relay.
 */
export function staticReadiness(cfg, hasBotToken, hasAppToken) {
    return [
        { ok: cfg.secretsEnvFile !== null || hasBotToken, label: "secrets-source", detail: cfg.secretsEnvFile ? `env file ${cfg.secretsEnvFile}` : "env vars only" },
        { ok: hasBotToken, label: "bot-token", detail: hasBotToken ? "resolved" : "unset (outbound cannot post; scope/membership verify unavailable)" },
        { ok: hasAppToken, label: "app-token (Socket Mode)", detail: hasAppToken ? "resolved" : "unset (inbound cannot connect)" },
        { ok: cfg.channel !== null, label: "channel", detail: cfg.channel ?? "unset (outbound cannot post)" },
        { ok: Boolean(cfg.inboundDestination), label: "inbound-destination", detail: cfg.inboundDestination },
        { ok: cfg.enabled, label: "enabled", detail: cfg.enabled ? "yes" : "no (run `rig slack enable`)" },
        ...channelMapReadiness(cfg),
    ];
}
/** #192: one row only when a channel map is set. Fields this version does not support make the
 *  row fail loudly: they are ignored, and saving the config refuses them. */
function channelMapReadiness(cfg) {
    if (!cfg.channelMap?.length)
        return [];
    const channels = new Set(cfg.channelMap.map((e) => e.channel)).size;
    const summary = `${cfg.channelMap.length} entr${cfg.channelMap.length === 1 ? "y" : "ies"} over ${channels} channel(s); \`rig slack verify\` checks membership in each`;
    const unsupported = unsupportedChannelMapFields(cfg);
    return [unsupported.length
            ? { ok: false, label: "channel-map", detail: `${summary}; IGNORED unsupported field(s) ${unsupported.join(", ")} (written by a newer OpenRig?); remove them before saving the config` }
            : { ok: true, label: "channel-map", detail: summary }];
}
//# sourceMappingURL=config.js.map