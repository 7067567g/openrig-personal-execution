// #192 — the Slack CHANNEL MAP: one install, one channel per rig or seat. Pure lookups over the
// connector config, shared by every place that needs "which channel": outbound posts and
// `rig slack verify`.
//
//   outbound: exact seat entry → rig entry → the default `channel`
//
// An absent or empty map is today's single-channel behaviour exactly. Inbound routing does not
// consult the map: a known thread routes to its seat in whatever channel it lives, and every
// other message lands at `inboundDestination` (thread-routing.ts).
import { parseSessionName, sessionRigOf, validateSessionNameChars } from "../../session-name.js";
const ENTRY_KEYS = new Set(["match", "channel"]);
function isSeatMatch(match) {
    return match.includes("@");
}
/** Fields this version does not know, per entry ("channelMap[0].inbound"). A config written by a
 *  newer OpenRig can carry them; reading it ignores them (see validateChannelMap). */
export function unsupportedChannelMapFields(cfg) {
    if (!Array.isArray(cfg.channelMap))
        return [];
    return cfg.channelMap.flatMap((entry, index) => entry && typeof entry === "object" && !Array.isArray(entry)
        ? Object.keys(entry).filter((key) => !ENTRY_KEYS.has(key)).map((key) => `channelMap[${index}].${key}`)
        : []);
}
/** Validate an authored channel map. Throws one teaching error naming the offending entry.
 *  `allowUnknownFields` is for READING a config: a field written by a newer OpenRig is ignored
 *  there (and reported by unsupportedChannelMapFields) so a downgrade keeps Slack running.
 *  Writing a config never allows one. */
export function validateChannelMap(cfg, opts = {}) {
    const map = cfg.channelMap;
    if (map === undefined)
        return;
    if (!Array.isArray(map))
        throw new Error("channelMap must be an array of { match, channel } entries");
    const seen = new Set();
    for (const [index, entry] of map.entries()) {
        const where = `channelMap[${index}]`;
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            throw new Error(`${where} must be an object { match, channel }`);
        const unknown = Object.keys(entry).filter((key) => !ENTRY_KEYS.has(key));
        if (unknown.length && !opts.allowUnknownFields) {
            const named = typeof entry.match === "string" ? ` ('${entry.match}')` : "";
            throw new Error(`${where}${named} has unsupported field(s) ${unknown.join(", ")}: slack-connector.json was written by a newer ` +
                `OpenRig version. Upgrade OpenRig, or edit the file by hand to remove them; nothing was changed.`);
        }
        const { match, channel } = entry;
        if (typeof match !== "string" || !match)
            throw new Error(`${where}.match must be a rig name (my-rig) or a seat (lead@my-rig)`);
        if (isSeatMatch(match)) {
            if (parseSessionName(match).kind !== "canonical") {
                throw new Error(`${where}.match '${match}' is not a seat: use member@rig (lead@my-rig) or a bare rig name (my-rig)`);
            }
        }
        else {
            const charError = validateSessionNameChars(match, "rig name");
            if (charError)
                throw new Error(`${where}.match: ${charError}`);
        }
        if (typeof channel !== "string" || !channel || /\s/.test(channel)) {
            throw new Error(`${where}.channel must be a Slack channel ID (e.g. C0EXAMPLE1) for '${match}'`);
        }
        if (seen.has(match))
            throw new Error(`channelMap has two entries for '${match}': edit slack-connector.json by hand and keep one entry`);
        seen.add(match);
    }
}
/** The channel a seat's human-bound items post to: seat entry → rig entry → default. */
export function resolveOutboundChannel(cfg, session) {
    const map = cfg.channelMap ?? [];
    if (session && map.length) {
        const seat = map.find((e) => isSeatMatch(e.match) && e.match === session);
        if (seat)
            return seat.channel;
        const rig = sessionRigOf(session);
        const rigEntry = rig ? map.find((e) => !isSeatMatch(e.match) && e.match === rig) : undefined;
        if (rigEntry)
            return rigEntry.channel;
    }
    return cfg.channel;
}
/** Every unique channel the connector posts to, the default first. */
export function mappedChannels(cfg) {
    const out = [];
    const byChannel = new Map();
    if (cfg.channel) {
        const d = { channel: cfg.channel, isDefault: true, matches: [] };
        out.push(d);
        byChannel.set(cfg.channel, d);
    }
    for (const entry of cfg.channelMap ?? []) {
        let c = byChannel.get(entry.channel);
        if (!c) {
            c = { channel: entry.channel, isDefault: false, matches: [] };
            out.push(c);
            byChannel.set(entry.channel, c);
        }
        c.matches.push(entry.match);
    }
    return out;
}
/** Add or replace the entry for `match` (CLI `channel-map set`), keeping its position. */
export function setChannelMapEntry(map, entry) {
    const authored = { match: entry.match, channel: entry.channel };
    const current = map ?? [];
    return current.some((e) => e.match === entry.match)
        ? current.map((e) => (e.match === entry.match ? authored : e))
        : [...current, authored];
}
/** Remove the entry for `match` (CLI `channel-map remove`). `removed` is false when absent. */
export function removeChannelMapEntry(map, match) {
    const before = map ?? [];
    const next = before.filter((e) => e.match !== match);
    return { map: next, removed: next.length !== before.length };
}
//# sourceMappingURL=channel-map.js.map