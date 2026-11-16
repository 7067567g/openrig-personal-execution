/** Instance-owned copy: independent of project cleanup and installed package replacement. */
export declare const CLAUDE_ACTIVITY_RELAY_RELATIVE_PATH = "state/claude-activity-hooks/activity-relay.cjs";
export declare function claudeActivityRelayPath(openrigHome?: string): string;
/** The `type` of the shipped runtime_resource that selects managed Claude activity hooks. */
export declare const CLAUDE_ACTIVITY_HOOKS_RESOURCE_TYPE = "claude_activity_hooks";
/** Minimal read surface (satisfied by both the adapter fs ops and the preflight fs ops). */
export interface ActivityHookFsRead {
    exists(path: string): boolean;
    readFile(path: string): string;
}
export interface ActivityRelayEvent {
    event: string;
    timeout?: number;
}
export interface ActivityHookDelivery {
    /** The relay asset source is present. */
    relaySourceOk: boolean;
    /** Relay events derived from the canonical claude.json manifest (compaction excluded). */
    events: ActivityRelayEvent[];
    /** Enable is deliverable: relay source present AND >= 1 relay event derived. */
    deliverable: boolean;
}
/**
 * Validate the delivery inputs: the relay source is present AND the canonical manifest yields
 * a nonempty relay event set. This is the ONE gate — both the adapter (before any strip/copy/
 * write) and preflight (to warn) call it with the same asset-path inputs.
 */
export declare function validateClaudeActivityHookDelivery(fs: ActivityHookFsRead, relayPath: string | null | undefined, manifestPath: string | null | undefined): ActivityHookDelivery;
/**
 * Relay event vocabulary DERIVED from the canonical claude.json manifest: the events whose
 * group invokes activity-relay.cjs (compaction/bridge groups excluded), with each event's
 * declared timeout. Empty when the manifest is absent / unreadable / non-object / has no
 * relay-backed events.
 */
export declare function deriveRelayEvents(fs: ActivityHookFsRead, manifestPath: string | null | undefined): ActivityRelayEvent[];
//# sourceMappingURL=claude-activity-hooks.d.ts.map