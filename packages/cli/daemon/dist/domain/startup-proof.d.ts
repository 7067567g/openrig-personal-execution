import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import type { AgentActivityStore } from "./agent-activity-store.js";
import type { NodeOriented } from "./types.js";
export type { NodeOriented } from "./types.js";
/** Per-reason reject code (append-only audit; never collapses into ready). */
export type ProofRejectReason = "identity_unbound" | "identity_mismatch" | "challenge_stale" | "contract_mismatch" | "bare_ack";
export interface IssuedChallenge {
    challengeId: string;
    contractHash: string;
    /** Recomputable; handed to the prompt so the agent can answer. Not persisted. */
    expectedAnswer: string;
    /** The block appended to / delivered as the startup prompt. */
    promptBlock: string;
}
export declare function computeContractHash(contractSource: string): string;
export declare function computeExpectedAnswer(challengeId: string, contractHash: string): string;
/**
 * Claude Code shows a long paste as pasted content and won't act on an instruction found only there.
 * This short line arrives as the person's own turn and asks the seat to run the command from the
 * challenge in its startup text. It carries no challenge id or answer, so a proof still shows the
 * startup text was read.
 */
export declare const STARTUP_PROOF_INSTRUCTION_LINE = "OpenRig, which launched this seat: please read your startup text above and run the startup-proof command from its orientation challenge.";
/**
 * Derive + persist (append-only event) a per-launch challenge and return the
 * prompt block. Call at fresh/fresh-fallback managed launch, BEFORE the
 * startup prompt is delivered, so the ground truth exists before any proof.
 */
export declare function issueStartupChallenge(eventBus: EventBus, input: {
    rigId: string;
    nodeId: string;
    contractSource: string;
}): IssuedChallenge;
export interface StartupProofInput {
    sessionName?: string | null;
    nodeId?: string | null;
    runtime?: string | null;
    challengeId?: string | null;
    answer?: string | null;
}
export type StartupProofResult = {
    ok: true;
    nodeId: string;
    rigId: string;
    challengeId: string;
} | {
    ok: false;
    code: ProofRejectReason;
    error: string;
};
/**
 * Verify an agent-emitted startup proof against the persisted per-launch
 * challenge. Identity-bound + anti-replay + content-correct, or an
 * append-only rejection with a per-reason code. Never sets `ready`; never
 * routes through updateStartupStatus.
 */
export declare function verifyStartupProof(deps: {
    store: AgentActivityStore;
    eventBus: EventBus;
}, input: StartupProofInput): StartupProofResult;
export declare function deriveOriented(db: Database.Database, nodeId: string): NodeOriented;
/**
 * FS-1 W1.3 S2 — batch `deriveOriented` for the whole fleet in ONE query
 * instead of one query per node (the ~175-query-per-poll residual). Fetches all
 * proof events, groups by `node_id` (ORDER BY node_id, seq DESC preserves each
 * node's seq-DESC order exactly), and runs the SAME `orientedFromRows` fold per
 * node. Byte-identical to per-node `deriveOriented`: `deriveOriented` is
 * node-scoped, so the per-node subset of rows + the identical fold yield the
 * identical verdict. Nodes with no proof events are simply absent (caller
 * defaults to "n-a", matching the no-challenge branch).
 */
export declare function buildOrientedMap(db: Database.Database): Map<string, NodeOriented>;
//# sourceMappingURL=startup-proof.d.ts.map