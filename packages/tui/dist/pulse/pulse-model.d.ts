import type { Token } from "../theme.js";
import type { Action, FleetSnapshot } from "../types.js";
/** One exception row: an accent glyph + bold subject + plain claim + dim metadata. */
export interface PulseException {
    glyph: string;
    token: Token;
    subject: string;
    claim: string;
    meta: string;
}
export interface PulseExceptionSection {
    glyph: string;
    token: Token;
    label: string;
    rows: PulseException[];
    /** Honesty-floor placeholder for a DEFERRED (not-yet-served) read: when set,
     * the section renders its header WITHOUT a (n) count and a single dim line
     * carrying this text — the explicit "read pending" transition-state form,
     * NOT a ran-join (whose zero result is silence). See buildPulseModel PARKED. */
    pending?: string;
}
export interface PulseLaneRow {
    glyph: string;
    token: Token;
    time?: string;
    label: string;
    selected?: boolean;
    /** incr-5 motion budget: this NOW seat produced fresh pane output inside the
     * one-shot flash window (a served terminalActive false→true onset, keyed by
     * the same agent key the table's row flash uses). Set by renderPulseScreen from
     * the refresh owner's rowFlashes; painted PER-CELL (inverse on THIS cell only,
     * never the zipped sibling cells). Reduced motion / window expiry clears it. */
    flashed?: boolean;
    /** incr-4 drill-in: the Action Enter/click dispatches on this row. Present on
     * every REAL lane row (absent on the "…" overflow marker, which is not an
     * entity). A row about a seat resolvable in the topology drills to that AGENT
     * (recovering the full identity the compact lane label drops); an unresolvable
     * seat degrades to a `notice` that reveals the full identity — honest, never a
     * dead key. Rows with no action are not registered as selection targets. */
    action?: Action;
}
export interface PulseLane {
    label: string;
    count: number;
    rows: PulseLaneRow[];
}
export interface PulseModel {
    queueSampleNote?: string;
    exceptions: PulseExceptionSection[];
    lanes: [PulseLane, PulseLane, PulseLane];
    footer: {
        active: number;
        parked: number;
        waitingYou: number;
        updatedAgo: string;
    };
}
export declare const PULSE_INFO_TOKEN: Token;
/** Increment-1 static fixture — the approved mock's EXACT rows (render contract). */
export declare function demoPulseModel(): PulseModel;
export declare function isHumanSeatSession(value: string | null | undefined): boolean;
/** Increment-3 LIVE builder — exception sections (incr 2/2b) PLUS the three
 * lanes + footer, all from the hydrated snapshot's SHIPPED reads. The LIVE joins
 * obey empty-strip-is-silence for the EXCEPTION sections (a ran join yielding
 * zero is OMITTED); the LANES always render (a lane with zero rows is an honest
 * "(0)", not silence — an empty backlog IS information). The footer counts are
 * derived FROM the built model so header numbers can never diverge from their
 * referent sets (label==referent). demoPulseModel is retained only as a static
 * renderer fixture (spatial-contract tests), no longer this builder's source. */
export declare function buildPulseModel(snap: FleetSnapshot, nowMs?: number): PulseModel;
//# sourceMappingURL=pulse-model.d.ts.map