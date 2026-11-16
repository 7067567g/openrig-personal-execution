import { type SlackConnectorConfig } from "./slack/config.js";
import type { SettingsStore } from "../user-settings/settings-store.js";
/** Shared passive read context. Raw values and the redactor stay inside the domain. */
export declare function readConnectionConfiguration(home: string): {
    cfg: SlackConnectorConfig | null;
    configPath: string;
    configState: string;
    sourceState: "malformed" | "available" | "unavailable" | "missing";
    fields: string[];
    bot: string | null;
    app: string | null;
    secretsAvailable: boolean;
    text: (v: unknown) => string | null;
};
/** Passive evidence only. No provider client, queue writer, or service activation. */
export declare function connectionsProjection(home: string, gateway: Record<string, unknown> | null, settings?: SettingsStore, read?: {
    cfg: SlackConnectorConfig | null;
    configPath: string;
    configState: string;
    sourceState: "malformed" | "available" | "unavailable" | "missing";
    fields: string[];
    bot: string | null;
    app: string | null;
    secretsAvailable: boolean;
    text: (v: unknown) => string | null;
}): {
    observedAt: string;
    home: string | null;
    pid: number;
    settingsSource: string | null;
    settings: {
        key: "host.name" | "workspace.root" | "workspace.operator_seat_name";
        value: string | null;
        source: string;
    }[];
    configSource: {
        state: string;
        path: string | null;
        sourceState: "malformed" | "available" | "unavailable" | "missing";
    };
    configuration: {
        enabled: boolean;
        channel: string | null;
        inboundDestination: string | null;
        outboundDestinations: (string | null)[];
        channelMap: {
            match: string | null;
            channel: string | null;
        }[];
        postLevel: "RECORD" | "NOTICE" | "ALERT";
        interruptLevel: "RECORD" | "NOTICE" | "ALERT";
        botToken: string;
        appToken: string;
    } | null;
    running: {
        state: string;
        activatedAt: string | null;
        outboundReady: boolean | null;
        inboundReady: boolean | null;
        inboundState: string;
        inboundDelivery: string | null;
        inboundEventsMissingSince: string | null;
        applied: string;
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
    humans: {
        browserKey: string;
        entityId: string;
        address: string;
        displayName: string | null;
        class: "human";
        away: boolean | null;
        deliveryClass: "C" | "A" | "B" | "D";
        availability: "available" | "off" | "away" | "focus";
        excluded: boolean | null;
        bindings: {
            browserKey: string;
            kind: "slack";
            ref: string | null;
            role: "primary" | "secondary";
            handle: string | null;
            credentialReference: boolean;
        }[];
    }[];
};
//# sourceMappingURL=connections-projection.d.ts.map