import type { Policy } from "./types.js";
import type { WatchdogHistoryEntry } from "../watchdog-history-log.js";
/** Structural view of the shipped SeatParkedDiagnosis (parked-query.ts). */
export interface ParkedSeatDiagnosisView {
    sessionName: string;
    parked: boolean | "indeterminate";
    activity: {
        value: string;
        needsInput: {
            count: number;
            reason: string | null;
        };
    };
    obligations: {
        items: Array<{
            qitemId: string;
            state: string;
            summary: string | null;
        }>;
        held: Array<{
            qitemId: string;
            healthy: boolean;
        }>;
    };
}
export interface RowTransitionView {
    ts: string;
    transitionNote: string | null;
    /** Who wrote the transition and the row state it records. A view without them can't show that a
     *  row is unchanged, so a repeat wake is never withheld on its account. */
    actorSession?: string;
    state?: string;
    /** The persisted transition order (global across rows); orders changes that share a millisecond. */
    transitionId?: number;
}
export interface ParkedOwnerConsumerDeps {
    /** The shipped rig-scoped diagnosis (diagnoseRigParked), adapter-constructed. */
    diagnoseRig: (rigName: string) => {
        seats: ParkedSeatDiagnosisView[];
    } | null;
    /** Telemetry — used ONLY to reconcile recent delivery outcomes onto rows
     *  (immediate horizon); NEVER as episode state. */
    history: {
        listForJob: (jobId: string, limit: number) => WatchdogHistoryEntry[];
        countForJob: (jobId: string) => number;
    };
    /** The durable row-side surfaces (queue repository, adapter-wired). */
    rows: {
        listTransitions: (qitemId: string) => RowTransitionView[];
        /** State-preserving note append; ok:false when the row is terminal or missing
         *  (the last guard of the delivery boundary). */
        appendNote: (qitemId: string, note: string) => {
            ok: boolean;
        };
        /** Lands a failed wake in the ladder's native vocabulary (last_nudge_result). */
        recordNudgeResult: (qitemId: string, result: string) => void;
        /** FRESH open-obligation ids for a seat at the send boundary (B1 recheck). */
        listOpenIds: (destinationSession: string) => string[];
        /** Existing delivery/recovery ownership; does not change the parked diagnosis. */
        recoveryOwnsWake?: (qitemId: string) => boolean;
    };
    /** The seat's live occupant generation, null when unknown. A delivered wake makes a repeat wait only
     *  for the occupant it reached, so without this reader every repeat is sent as on main. */
    occupantGeneration?: (sessionName: string) => string | null;
}
export declare const PARKED_OWNER_POLICY_NAME = "parked-owner-consumer";
/** Stable per-rig registration anchor: member@rig shape, policy name as slug. */
export declare function makeRigAnchor(rigName: string): string;
export declare function rigFromAnchor(targetSession: string): string;
export declare const RESERVE_PREFIX = "parked-owner wake reserved:";
export declare const CLOSE_PREFIX = "parked-owner episode closed:";
export declare const REFUSED_PREFIX = "parked-owner wake delivery refused:";
export declare const FAILED_PREFIX = "parked-owner wake delivery failed:";
/** The engine reported the wake delivered. Only a delivered wake can make a later repeat wait. */
export declare const DELIVERED_PREFIX = "parked-owner wake delivered:";
export declare const NUDGE_FAIL_PREFIX = "failed: parked-owner wake delivery";
/** Open positive refusals and the exact obligation set reserved before delivery. */
export declare function openPromptRefusals(transitions: RowTransitionView[]): Array<{
    key: string;
    ids: string[];
    refusedAt: string;
}>;
export declare function makeParkedOwnerConsumerPolicy(deps: ParkedOwnerConsumerDeps): Policy;
//# sourceMappingURL=parked-owner-consumer.d.ts.map