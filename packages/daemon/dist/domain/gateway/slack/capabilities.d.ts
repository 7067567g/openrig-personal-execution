/** Baseline bot scopes: the default `requiredScopes` that `rig slack verify` checks. */
export declare const BASELINE_REQUIRED_SCOPES: readonly string[];
/** Bot scopes the shipped connector code uses beyond the baseline. `rig slack verify` does not
 *  require them, so a baseline READY does not prove these features have their grants. The app
 *  manifest requests them; each entry names the code path that needs it. */
export declare const FEATURE_SCOPES: ReadonlyArray<{
    scope: string;
    usedBy: string;
}>;
/** The Slack event payload types the inbound path admits (the `type` gate of ingestDecision). */
export declare const ADMITTED_EVENT_TYPES: readonly string[];
/** Admitted payload type → the Slack bot event to subscribe to, and the scope Slack requires for
 *  it. A subscription name is not always the payload type: `message.channels` delivers payloads
 *  of type `message`. Public channels only; no DM or private-channel subscriptions. */
export declare const EVENT_SUBSCRIPTIONS: Readonly<Record<string, {
    subscription: string;
    scope: string;
}>>;
//# sourceMappingURL=capabilities.d.ts.map