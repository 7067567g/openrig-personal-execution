export interface ChannelMapEntry {
    /** A rig name (`my-rig`) or a full seat session name (`lead@my-rig`). */
    match: string;
    /** Slack channel ID this rig's or seat's human-bound items post to. */
    channel: string;
}
export interface ChannelMapConfig {
    channel: string | null;
    channelMap?: ChannelMapEntry[];
}
/** Fields this version does not know, per entry ("channelMap[0].inbound"). A config written by a
 *  newer OpenRig can carry them; reading it ignores them (see validateChannelMap). */
export declare function unsupportedChannelMapFields(cfg: ChannelMapConfig): string[];
/** Validate an authored channel map. Throws one teaching error naming the offending entry.
 *  `allowUnknownFields` is for READING a config: a field written by a newer OpenRig is ignored
 *  there (and reported by unsupportedChannelMapFields) so a downgrade keeps Slack running.
 *  Writing a config never allows one. */
export declare function validateChannelMap(cfg: ChannelMapConfig, opts?: {
    allowUnknownFields?: boolean;
}): void;
/** The channel a seat's human-bound items post to: seat entry → rig entry → default. */
export declare function resolveOutboundChannel(cfg: ChannelMapConfig, session: string | null | undefined): string | null;
export interface MappedChannel {
    channel: string;
    /** True for the default `channel`. */
    isDefault: boolean;
    /** The map entries that post here (empty for a default channel nothing maps to). */
    matches: string[];
}
/** Every unique channel the connector posts to, the default first. */
export declare function mappedChannels(cfg: ChannelMapConfig): MappedChannel[];
/** Add or replace the entry for `match` (CLI `channel-map set`), keeping its position. */
export declare function setChannelMapEntry(map: readonly ChannelMapEntry[] | undefined, entry: ChannelMapEntry): ChannelMapEntry[];
/** Remove the entry for `match` (CLI `channel-map remove`). `removed` is false when absent. */
export declare function removeChannelMapEntry(map: readonly ChannelMapEntry[] | undefined, match: string): {
    map: ChannelMapEntry[];
    removed: boolean;
};
//# sourceMappingURL=channel-map.d.ts.map