import { type ContentLine } from "../detail.js";
import type { FleetSnapshot } from "../types.js";
/** Selected, value-safe daemon projection; raw config and connector errors never enter the TUI. */
export interface ConnectionsRead {
    observedAt: string;
    home: string | null;
    pid: number;
    settingsSource: string | null;
    settings: Array<{
        key: string;
        value: string | null;
        source: string;
    }>;
    configSource: {
        state: string;
        path: string | null;
    };
    configuration: null | {
        enabled: boolean;
        channel: string | null;
        inboundDestination: string | null;
        outboundDestinations: Array<string | null>;
        postLevel: string;
        interruptLevel: string;
        botToken: string;
        appToken: string;
        /** #192: absent from daemons that predate the channel map. */
        channelMap?: Array<{
            match: string | null;
            channel: string | null;
        }>;
    };
    running: {
        state: string;
        activatedAt: string | null;
        outboundReady: boolean | null;
        inboundReady: boolean | null;
        inboundState: string;
        applied: string;
        inboundDelivery?: string | null;
        inboundEventsMissingSince?: string | null;
    };
    state: string;
    nextAction: string;
    verification: {
        state: string;
        at: string | null;
        actor: string | null;
    };
    registry: {
        state: string;
        path: string | null;
    };
    humans: Array<{
        entityId: string;
        address: string;
        displayName: string | null;
        deliveryClass: string;
        availability: string;
        excluded: boolean | null;
        bindings: Array<{
            kind: string;
            ref: string | null;
            role: string;
            handle: string | null;
        }>;
    }>;
}
/** The daemon's read-only Slack app manifest (GET /api/gateway/slack/manifest). */
export interface SlackManifestRead {
    yaml: string;
    url: string;
    scopes?: string[];
    events?: string[];
}
export declare const SLACK_MANIFEST_EXPAND_KEY = "slack:manifest";
/** No Slack app yet: neither token resolves. Unknown token state is not "not configured". */
export declare function slackNotConfigured(c: ConnectionsRead): boolean;
export interface ControlPlaneRead {
    status?: string;
    semver?: string;
    commit?: string;
    dirty?: boolean;
    builtAt?: string;
    selfHostId?: string | null;
    selfHostIdSource?: string;
}
export declare function connectionsLines(snap: FleetSnapshot, width: number, timeZone?: string, expanded?: readonly string[]): ContentLine[];
/** An open socket is not proof that events arrive, so the delivery word is named beside the state.
 *  A daemon too old to report delivery leaves the bare state. */
export declare function inboundValue(r: ConnectionsRead["running"]): string;
//# sourceMappingURL=connections-model.d.ts.map