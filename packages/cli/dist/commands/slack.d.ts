import { Command } from "commander";
import { DaemonClient } from "../client.js";
import type { loadConfig as LoadConfigFn, saveConfig as SaveConfigFn, staticReadiness as StaticReadinessFn, resolveSecret as ResolveSecretFn, checkEnvFilePermissions as CheckEnvFn, verifyScopes as VerifyScopesFn, verifyChannelMembership as VerifyMembershipFn, buildSlackAppManifest as BuildManifestFn, mappedChannels as MappedChannelsFn, validateChannelMap as ValidateChannelMapFn, setChannelMapEntry as SetChannelMapEntryFn, removeChannelMapEntry as RemoveChannelMapEntryFn, FEATURE_SCOPES as FeatureScopes, BASELINE_REQUIRED_SCOPES as BaselineScopes, FetchImpl } from "@openrig-local/daemon/gateway-slack";
/** The socket's delivery health, as the daemon reports it beside the socket state. */
export interface InboundDeliveryStatus {
    delivery?: string;
    eventsMissingSince?: string;
    lastServerPingAt?: string;
    unechoedPosts?: number;
    numConnections?: number;
    otherConnections?: number;
    otherConnectionsMayBeOurs?: boolean;
    lastAutoReconnect?: {
        at?: string;
        reason?: string;
    };
    autoReconnectSuppressedUntil?: string;
}
/** Lines that keep "connected" from being the only word about inbound delivery. */
export declare function socketDeliveryLines(inbound: InboundDeliveryStatus | undefined): string[];
interface SlackSurface {
    loadConfig: typeof LoadConfigFn;
    saveConfig: typeof SaveConfigFn;
    staticReadiness: typeof StaticReadinessFn;
    resolveSecret: typeof ResolveSecretFn;
    checkEnvFilePermissions: typeof CheckEnvFn;
    verifyScopes: typeof VerifyScopesFn;
    verifyChannelMembership: typeof VerifyMembershipFn;
    buildSlackAppManifest: typeof BuildManifestFn;
    mappedChannels: typeof MappedChannelsFn;
    validateChannelMap: typeof ValidateChannelMapFn;
    setChannelMapEntry: typeof SetChannelMapEntryFn;
    removeChannelMapEntry: typeof RemoveChannelMapEntryFn;
    FEATURE_SCOPES: typeof FeatureScopes;
    BASELINE_REQUIRED_SCOPES: typeof BaselineScopes;
}
export interface SlackDeps {
    home?: string;
    fetchImpl?: FetchImpl;
    log?: (msg: string) => void;
    /** Injectable daemon-surface loader (tests). Default: lazy import of the narrow subpath. */
    surface?: () => Promise<SlackSurface>;
    clientFactory?: () => Pick<DaemonClient, "post"> & Partial<Pick<DaemonClient, "get">>;
}
export declare function slackCommand(deps?: SlackDeps): Command;
export {};
//# sourceMappingURL=slack.d.ts.map