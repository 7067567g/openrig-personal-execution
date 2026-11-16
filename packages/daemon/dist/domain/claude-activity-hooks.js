import { resolve } from "node:path";
import { getOpenRigHome } from "../openrig-compat.js";
// Single source of truth for whether the OpenRig-managed Claude activity-relay hooks can be
// DELIVERED, and which events to inject. Consumed by BOTH the ClaudeCodeAdapter reconcile (to
// gate enable) AND rigspec-preflight (to warn) — one validation + one manifest parser, so the
// two seams cannot drift. The event COMMANDS are constructed by the adapter (absolute, shell-
// quoted); this module also owns the instance-scoped relay destination.
/** Instance-owned copy: independent of project cleanup and installed package replacement. */
export const CLAUDE_ACTIVITY_RELAY_RELATIVE_PATH = "state/claude-activity-hooks/activity-relay.cjs";
export function claudeActivityRelayPath(openrigHome = getOpenRigHome()) {
    return resolve(openrigHome, CLAUDE_ACTIVITY_RELAY_RELATIVE_PATH);
}
/** The `type` of the shipped runtime_resource that selects managed Claude activity hooks. */
export const CLAUDE_ACTIVITY_HOOKS_RESOURCE_TYPE = "claude_activity_hooks";
/**
 * Validate the delivery inputs: the relay source is present AND the canonical manifest yields
 * a nonempty relay event set. This is the ONE gate — both the adapter (before any strip/copy/
 * write) and preflight (to warn) call it with the same asset-path inputs.
 */
export function validateClaudeActivityHookDelivery(fs, relayPath, manifestPath) {
    const relaySourceOk = !!relayPath && fs.exists(relayPath);
    const events = deriveRelayEvents(fs, manifestPath);
    return { relaySourceOk, events, deliverable: relaySourceOk && events.length > 0 };
}
/**
 * Relay event vocabulary DERIVED from the canonical claude.json manifest: the events whose
 * group invokes activity-relay.cjs (compaction/bridge groups excluded), with each event's
 * declared timeout. Empty when the manifest is absent / unreadable / non-object / has no
 * relay-backed events.
 */
export function deriveRelayEvents(fs, manifestPath) {
    if (!manifestPath || !fs.exists(manifestPath))
        return [];
    let manifest;
    try {
        manifest = JSON.parse(fs.readFile(manifestPath));
    }
    catch {
        return [];
    }
    const hooks = isPlainObject(manifest) && isPlainObject(manifest["hooks"]) ? manifest["hooks"] : {};
    const out = [];
    const seen = new Set();
    for (const [event, groups] of Object.entries(hooks)) {
        if (seen.has(event) || !Array.isArray(groups))
            continue;
        for (const group of groups) {
            if (!isPlainObject(group) || !Array.isArray(group["hooks"]))
                continue;
            const relay = group["hooks"].find((h) => {
                const c = isPlainObject(h) && typeof h["command"] === "string" ? h["command"] : "";
                return c.includes("activity-relay.cjs");
            });
            if (relay) {
                const t = isPlainObject(relay) ? relay["timeout"] : undefined;
                out.push({ event, timeout: typeof t === "number" ? t : undefined });
                seen.add(event);
                break;
            }
        }
    }
    return out;
}
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
//# sourceMappingURL=claude-activity-hooks.js.map