import { type ContentLine } from "../detail.js";
import type { FleetSnapshot } from "../types.js";
import { type Row } from "./usage-model.js";
export interface UsageHostsRead {
    /** The served view, or why it couldn't be read (status null: no HTTP answer; message: the daemon's own text). */
    status: {
        view: Row;
    } | {
        status: number | null;
        error: string;
        message?: string;
    };
}
export declare const USAGE_HOSTS_HEADER = "registered hosts, as this daemon reads them \u00B7 not proof of the login a running session uses";
export declare const USAGE_HOSTS_HINT = "This view shows what the hosts already hold. It never starts a refresh or reads the logins. To read them now: rig provider status --all-hosts --refresh [--provider codex|claude]";
export declare function usageHostsLines(snap: FleetSnapshot, width: number): ContentLine[];
//# sourceMappingURL=usage-hosts-model.d.ts.map