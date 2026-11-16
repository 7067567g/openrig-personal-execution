import type { AggregatedPayload, PerHostStatus } from "../hosts/fanout-contract.js";
import type { HostEntry, HostRegistryLoadResult } from "../hosts/hosts-registry-reader.js";
import { type RemoteJsonResult } from "../hosts/remote-daemon-http.js";
import type { FourBlockReadModel, ProviderKind, ProviderUsageAllowance, SeatConfiguredAccount } from "./provider-types.js";
/** Reading a host's served model is an ordinary read: the same 5 s class as the read-through and the feed. */
export declare const USAGE_HOSTS_READ_TIMEOUT_MS = 5000;
export declare const USAGE_HOSTS_READ_CONCURRENCY = 4;
/** The whole view answers within this, whatever the registry's size: hosts not heard from by then are listed as such,
 *  and the rest are served. One host takes at most 10 s (5 s status, then 5 s settings when it's off or older), so the
 *  first four hosts always fit; a caller waiting 20 s has 5 s left for this host's own read and the transfer. */
export declare const USAGE_HOSTS_VIEW_DEADLINE_MS = 15000;
/** The largest answer read from a host (status, settings or refresh), stopped at the bound and never parsed. A status
 *  answer with both providers and a few dozen seats is tens of kilobytes; 1 MiB leaves room for hundreds of seats. */
export declare const USAGE_HOSTS_MAX_BYTES: number;
/** The deepest nesting accepted in a host's answer. Today's deepest is about seven levels (a status answer's usage row,
 *  window, disagreeing seat); past 32 the answer is malformed, and that host is unavailable. */
export declare const USAGE_HOSTS_MAX_DEPTH = 32;
/** What replaces any string from a host that contains the bearer configured for that host. */
export declare const BEARER_REDACTED = "[redacted: contained this host's bearer]";
/** A refresh leg waits for the host's own bounded native read plus stopping what it started (Codex 35 s + ~8 s;
 *  Claude's auth status 10 s + ~3 s), with a margin for the network. Never the 5 s read class. */
export declare const REMOTE_USAGE_REFRESH_DEADLINE_MS: Record<ProviderKind, number>;
export type HostUsageCoverage = "served" | "off" | "older" | "unavailable";
export interface UsageRefreshLeg {
    hostId: string;
    provider: ProviderKind;
    at: string;
    outcome: "ok" | "failed";
    /** True when this request joined a leg already running, here or at the host. */
    coalesced: boolean;
    reason?: string;
    detail?: string;
}
export interface UsageHostStatus extends PerHostStatus {
    /** Whether this host serves usage windows, apart from whether it answered. */
    usage: HostUsageCoverage;
    usageReason?: string;
    /** When this daemon read the host; null when it couldn't be read. */
    readAt: string | null;
    /** The last refresh leg this daemon ran to the host, per provider (kept in memory). */
    lastRefresh?: Partial<Record<ProviderKind, UsageRefreshLeg>>;
}
export interface UsageObservation {
    hostId: string;
    readAt: string;
    /** The host's own served row, verbatim. */
    row: ProviderUsageAllowance;
}
/**
 * Between the observations inside one group. single: one host observed it. same: several hosts observed one allowance
 * (each observation kept; never summed). conflict: several hosts observed one allowance and disagree about a window's
 * reset. unknown: the identity is unresolved, or one host's observation of an id can't be linked to other hosts'
 * observations of it (the notes name them).
 */
export type UsageLinkage = "single" | "same" | "conflict" | "unknown";
export interface UsageAllowanceGroup {
    provider: ProviderKind;
    /** The allowance identity key the hosts key their rows by; null when unresolved. */
    key: string | null;
    linkage: UsageLinkage;
    observations: UsageObservation[];
    notes: string[];
}
export interface UsageAcrossHosts extends AggregatedPayload<UsageAllowanceGroup> {
    hosts: UsageHostStatus[];
    /** Registry entries that name this daemon itself, so not read twice. */
    skipped: Array<{
        hostId: string;
        reason: string;
    }>;
    registry: {
        state: "read" | "absent" | "unreadable";
        note?: string;
    };
    /** Each host's configured seat accounts, verbatim; never linked to an allowance. */
    seatAccounts: Array<{
        hostId: string;
        seats: SeatConfiguredAccount[];
    }>;
    asOf: string;
}
/** The key a host keyed this row by (the same functions the hosts use); null when unresolved or never read. */
export declare function allowanceKey(row: ProviderUsageAllowance): string | null;
/**
 * Which observations may be linked across hosts. Claude's key already includes the email. Codex's doesn't: within
 * one host a single login is read, but across hosts the same account or workspace id can come with different login
 * emails, and the source can't tell one allowance from a workspace whose members have their own limits. So across
 * hosts a Codex observation links only under the same login email too; the rest stay apart as unknown linkage. A
 * missing (or empty) email is no evidence of the same login, so an observation without one links to nothing on
 * another host.
 */
export declare function crossHostLinkKey(row: ProviderUsageAllowance, key: string, hostId: string): string;
export declare function groupUsageAcrossHosts(observations: UsageObservation[]): UsageAllowanceGroup[];
export interface UsageHostsDeps {
    loadRegistry: () => HostRegistryLoadResult;
    selfHostId: string | null;
    /** Narrow the remote hosts to these registry ids (this daemon is always included). */
    only?: string[];
    lastRefresh?: (hostId: string) => Partial<Record<ProviderKind, UsageRefreshLeg>> | undefined;
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
    readFile?: (path: string) => string;
    readTimeoutMs?: number;
    viewDeadlineMs?: number;
    concurrency?: number;
    now?: () => string;
}
export type HostSelection = {
    ok: true;
    remotes: HostEntry[];
    skipped: UsageAcrossHosts["skipped"];
    registry: UsageAcrossHosts["registry"];
} | {
    ok: false;
    error: string;
};
/** The registry hosts a call covers: every entry (ssh ones are reported, not read), minus this daemon itself. */
export declare function selectUsageHosts(deps: Pick<UsageHostsDeps, "loadRegistry" | "selfHostId" | "only">): HostSelection;
type Check = (v: unknown) => boolean;
/** A served row with every field the grouping and the views read, typed as provider-types.ts says. */
export declare function isUsageRow(v: unknown): v is ProviderUsageAllowance;
/** A served seat account with every field the views read, typed as provider-types.ts says. */
export declare const isSeat: Check;
/**
 * A host's answer with any string that contains the bearer configured for that host replaced, and any key that
 * contains it dropped, so a host echoing it can't put it in the view, the CLI or the kept refresh record (the same
 * rule as the Pi charge lookup's key echo). The bearer is resolved by the transport's own resolver and never logged.
 */
export declare function scrubBearer(value: unknown, bearer: string | undefined, depth?: number): unknown;
/** A host's answer nested past USAGE_HOSTS_MAX_DEPTH. */
export declare class AnswerTooDeep extends Error {
    constructor();
}
/** The view across hosts. The caller has checked that this daemon serves usage windows (`local.usage` present). */
export declare function readUsageAcrossHosts(local: FourBlockReadModel, selection: Extract<HostSelection, {
    ok: true;
}>, deps: UsageHostsDeps): Promise<UsageAcrossHosts>;
type LegResult = Omit<UsageRefreshLeg, "hostId" | "provider" | "coalesced"> & {
    coalesced?: boolean;
};
/** Maps a host's answer to its refresh route into a leg. The host keeps its own reading on its own failure. */
export declare function remoteRefreshLeg(res: RemoteJsonResult, provider: ProviderKind, deadlineMs: number, at: string): LegResult;
/**
 * Refresh legs, one per (host, provider) at a time: a request that overlaps a running leg joins it. The last leg per
 * host and provider is kept in memory (a daemon restart forgets it, as each host's own last refresh is forgotten).
 */
export declare class UsageRefreshLegs {
    private readonly opts;
    private readonly inflight;
    private readonly last;
    constructor(opts?: {
        deadlineMs?: Partial<Record<ProviderKind, number>>;
        now?: () => string;
    });
    deadlineFor(provider: ProviderKind): number;
    lastFor(hostId: string): Partial<Record<ProviderKind, UsageRefreshLeg>> | undefined;
    run(hostId: string, provider: ProviderKind, start: () => Promise<LegResult>): Promise<UsageRefreshLeg>;
    /** One leg to a registry host's own refresh route, bounded by the provider's refresh deadline. */
    remote(host: HostEntry, provider: ProviderKind, deps: Pick<UsageHostsDeps, "fetchImpl" | "env" | "readFile">): Promise<UsageRefreshLeg>;
}
export {};
//# sourceMappingURL=usage-across-hosts.d.ts.map