import { type OwnerNotificationLevel } from "../../queue-transition-log.js";
import { type ChannelMapEntry } from "./channel-map.js";
export interface SlackConnectorConfig {
    enabled: boolean;
    /** Inbound: human Slack messages land here. First-class + overridable (T1075). */
    inboundDestination: string;
    /** Optional explicit human-seat allow-list for outbound (empty = any human-seat/human-gate). */
    outboundDestinations: string[];
    /** Where the queue lives, shown in the posted message footer (never hardcoded). */
    sourceLabel: string;
    /** Slack channel the connector app must be a member of (verified live, item 5). */
    channel: string | null;
    /** Bot scopes the connector requires; verified against GRANTED header, not config (item 5). */
    requiredScopes: string[];
    /** Path to the 0600 env file holding secrets (webhook URL, bot/app tokens). */
    secretsEnvFile: string | null;
    /**
     * S10: VESTIGIAL — the relay's remote-queue targeting (OPENRIG_URL for a connector host
     * that differed from the queue host). The in-daemon subsystem reads its own QueueRepository
     * directly, so this is never consulted; the field stays so existing config files load
     * unchanged. Remove at the next config-schema rev.
     */
    queueUrl: string | null;
    minimumLevelThatPosts: OwnerNotificationLevel;
    minimumLevelThatInterrupts: OwnerNotificationLevel;
    /**
     * #192: optional per-rig / per-seat outbound channels (channel-map.ts). Absent or empty = every
     * item posts to `channel`, as before. Deliberately not in DEFAULT_CONFIG, so a config without
     * it saves and digests unchanged.
     */
    channelMap?: ChannelMapEntry[];
}
export declare const DEFAULT_CONFIG: SlackConnectorConfig;
export declare function configPathFor(home?: string): string;
export declare function loadConfig(home?: string): SlackConnectorConfig;
export declare function saveConfig(cfg: SlackConnectorConfig, home?: string): string;
export declare function configFileExists(home?: string): boolean;
export interface ReadinessItem {
    ok: boolean;
    label: string;
    detail: string;
}
/**
 * HONEST unconfigured state (item 5): a static (no-network) readiness checklist
 * from config + secret RESOLVABILITY (not values). Live scope/membership checks
 * are `rig slack verify`. Never throws; reports what's missing.
 *
 * S10: outbound posts via the Web API (`chat.postMessage`) on the in-daemon subsystem — the
 * bot token + channel are the outbound gate now; the incoming webhook retired with the relay.
 */
export declare function staticReadiness(cfg: SlackConnectorConfig, hasBotToken: boolean, hasAppToken: boolean): ReadinessItem[];
//# sourceMappingURL=config.d.ts.map