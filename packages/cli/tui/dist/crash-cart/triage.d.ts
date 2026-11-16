import type { Token } from "../theme.js";
export type TriageStatus = "red" | "yellow" | "green";
/** One seat's restore-check evidence (the tui-local view of the daemon's CheckEntry[] — parsed, so no
 *  @openrig-local/daemon dep; the light-TUI fence). */
export interface TriageCheckInput {
    seat: string;
    entries: Array<{
        check: string;
        status: TriageStatus;
        evidence: string;
        remediation: string;
        remediationSafe?: boolean;
    }>;
}
/** A triage row = a seat + the failing check it needs resolved. */
export interface TriageRow {
    seat: string;
    check: string;
    status: "red" | "yellow";
    /** What the seat needs (the remediation). */
    need: string;
    evidence: string;
    remediationSafe: boolean;
}
interface Seg {
    text: string;
    token?: Token;
    bold?: boolean;
}
interface Line {
    text: string;
    segs?: Seg[];
}
/** Flatten per-seat failing checks into triage rows (green omitted); red before yellow. */
export declare function buildTriageModel(input: TriageCheckInput[]): TriageRow[];
/** Render the triage list: a header + one row per need (seat + remediation, the check dim), or the
 *  all-clean line when nothing needs attention. */
export declare function renderTriage(rows: TriageRow[]): Line[];
export {};
//# sourceMappingURL=triage.d.ts.map