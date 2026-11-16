import { createHash, randomBytes } from "node:crypto";
/** A presence-floor ACK is never proof (business rule 2). */
const BARE_ACK_TOKENS = new Set(["", "ack", "ok", "ready", "done", "oriented", "acknowledged"]);
export function computeContractHash(contractSource) {
    return createHash("sha256").update(contractSource).digest("hex");
}
export function computeExpectedAnswer(challengeId, contractHash) {
    return createHash("sha256").update(`${challengeId}:${contractHash}`).digest("hex").slice(0, 32);
}
/**
 * Claude Code shows a long paste as pasted content and won't act on an instruction found only there.
 * This short line arrives as the person's own turn and asks the seat to run the command from the
 * challenge in its startup text. It carries no challenge id or answer, so a proof still shows the
 * startup text was read.
 */
export const STARTUP_PROOF_INSTRUCTION_LINE = "OpenRig, which launched this seat: please read your startup text above and run the startup-proof command from its orientation challenge.";
function buildProofSubmissionCommand(challengeId, expectedAnswer) {
    return `rig startup-proof submit --challenge-id ${challengeId} --answer ${expectedAnswer}`;
}
function buildPromptBlock(challengeId, expectedAnswer) {
    return [
        "--- OpenRig startup orientation challenge ---",
        `challengeId: ${challengeId}`,
        "After you have read your startup contract (all the files/identity above),",
        "prove you oriented by submitting an authenticated startup_proof with EXACTLY:",
        `  answer: ${expectedAnswer}`,
        "",
        "Run this command from your shell/tools after reading the contract:",
        buildProofSubmissionCommand(challengeId, expectedAnswer),
        "A bare acknowledgement (\"ack\"/\"ready\") is presence only, NEVER proof.",
        "--------------------------------------------",
    ].join("\n");
}
/**
 * Derive + persist (append-only event) a per-launch challenge and return the
 * prompt block. Call at fresh/fresh-fallback managed launch, BEFORE the
 * startup prompt is delivered, so the ground truth exists before any proof.
 */
export function issueStartupChallenge(eventBus, input) {
    const challengeId = randomBytes(16).toString("hex");
    const contractHash = computeContractHash(input.contractSource);
    const expectedAnswer = computeExpectedAnswer(challengeId, contractHash);
    eventBus.emit({
        type: "node.startup_challenged",
        rigId: input.rigId,
        nodeId: input.nodeId,
        challengeId,
        contractHash,
    });
    return { challengeId, contractHash, expectedAnswer, promptBlock: buildPromptBlock(challengeId, expectedAnswer) };
}
/**
 * Verify an agent-emitted startup proof against the persisted per-launch
 * challenge. Identity-bound + anti-replay + content-correct, or an
 * append-only rejection with a per-reason code. Never sets `ready`; never
 * routes through updateStartupStatus.
 */
export function verifyStartupProof(deps, input) {
    const { store, eventBus } = deps;
    const db = store.db;
    // (a) IDENTITY — resolve {sessionId,nodeId,rigId}; an unknown identity is
    // rejected and NO node-scoped state is projected (we cannot attribute an
    // event to an unknown node).
    const resolved = store.resolveSession({ sessionName: input.sessionName, nodeId: input.nodeId, runtime: input.runtime });
    if (!resolved) {
        return { ok: false, code: "identity_unbound", error: "startup_proof did not resolve to a managed session/node" };
    }
    // (a2) IDENTITY BINDING — the proof must bind to BOTH nodeId AND sessionName.
    // `resolveSession` prioritizes nodeId and does NOT cross-check a supplied
    // sessionName, so a proof carrying nodeId=node-a + sessionName=node-b would
    // otherwise resolve to (and false-verify) node-a while claiming node-b's
    // identity. Reject any conflict. We do NOT emit a node-scoped rejection for
    // the resolved node here (mirroring identity_unbound): a mismatched /
    // cross-seat / malformed proof must not touch the resolved node's projection
    // at all — never verify it, and never downgrade it to `rejected` either.
    // (runtime is a non-authoritative hint used for hook classification, not an
    // identity key — the seat identity is the nodeId<->sessionName binding.)
    if (input.sessionName && input.sessionName !== resolved.sessionName) {
        return { ok: false, code: "identity_mismatch", error: "startup_proof nodeId and sessionName resolve to different seats" };
    }
    // A new lean launch retires any earlier challenge without deleting history.
    const challengeRow = db.prepare("SELECT type, payload, seq FROM events WHERE node_id = ? AND type IN ('node.startup_challenged','node.startup_proof_skipped') ORDER BY seq DESC LIMIT 1").get(resolved.nodeId);
    if (!challengeRow || challengeRow.type === "node.startup_proof_skipped") {
        // Never challenged (e.g. a resumed restore, or a non-agent path). A proof
        // has nothing to verify against — reject as stale WITHOUT appending an
        // event, so the node's oriented projection stays honest (`n-a`).
        return { ok: false, code: "challenge_stale", error: "no active startup challenge for this node" };
    }
    let current;
    try {
        current = JSON.parse(challengeRow.payload);
    }
    catch {
        return { ok: false, code: "challenge_stale", error: "startup challenge payload unreadable" };
    }
    const answer = (input.answer ?? "").trim();
    const emitRejected = (reason) => {
        eventBus.emit({
            type: "node.startup_proof_rejected",
            rigId: resolved.rigId,
            nodeId: resolved.nodeId,
            challengeId: input.challengeId ?? null,
            reason,
        });
    };
    // (b) THIS-LAUNCH — the answered challenge must be the current one. A
    // replayed prior-launch answer carries a stale challengeId.
    if (!input.challengeId || input.challengeId !== current.challengeId) {
        emitRejected("challenge_stale");
        return { ok: false, code: "challenge_stale", error: "challengeId does not match this launch's challenge (replay/stale)" };
    }
    // (d) bare-ACK / empty / presence-floor is never proof.
    if (BARE_ACK_TOKENS.has(answer.toLowerCase())) {
        emitRejected("bare_ack");
        return { ok: false, code: "bare_ack", error: "a bare acknowledgement is presence only, never proof" };
    }
    // (c) CONTRACT — recompute the expected answer from the persisted contract
    // hash. A plausible-but-content-wrong answer is rejected.
    const expected = computeExpectedAnswer(current.challengeId, current.contractHash);
    if (answer !== expected) {
        emitRejected("contract_mismatch");
        return { ok: false, code: "contract_mismatch", error: "proof answer does not match the delivered startup contract" };
    }
    eventBus.emit({
        type: "node.startup_proof_verified",
        rigId: resolved.rigId,
        nodeId: resolved.nodeId,
        sessionId: resolved.sessionId,
        challengeId: current.challengeId,
        contractHash: current.contractHash,
    });
    return { ok: true, nodeId: resolved.nodeId, rigId: resolved.rigId, challengeId: current.challengeId };
}
/**
 * The pure oriented fold over ONE node's proof events (seq DESC). Extracted
 * verbatim from the prior inline `deriveOriented` body so the per-node reader
 * and the FS-1 W1.3 S2 batched builder (`buildOrientedMap`) share ONE
 * implementation — same verdicts by construction, no drift.
 */
function orientedFromRows(rows) {
    const challengeRow = rows.find((r) => r.type === "node.startup_challenged" || r.type === "node.startup_proof_skipped");
    if (!challengeRow || challengeRow.type === "node.startup_proof_skipped")
        return "n-a";
    let currentChallengeId;
    try {
        currentChallengeId = JSON.parse(challengeRow.payload).challengeId;
    }
    catch {
        return "n-a";
    }
    // The most-recent proof event referencing the current challenge decides
    // verified-vs-rejected (a later verify overrides an earlier reject).
    for (const row of rows) {
        if (row.seq <= challengeRow.seq)
            break;
        if (row.type !== "node.startup_proof_verified" && row.type !== "node.startup_proof_rejected")
            continue;
        let cid = null;
        try {
            cid = JSON.parse(row.payload).challengeId;
        }
        catch {
            continue;
        }
        if (cid !== currentChallengeId)
            continue;
        return row.type === "node.startup_proof_verified" ? "verified" : "rejected";
    }
    return "missing";
}
export function deriveOriented(db, nodeId) {
    const rows = db.prepare("SELECT type, payload, seq FROM events WHERE node_id = ? AND type IN ('node.startup_challenged','node.startup_proof_skipped','node.startup_proof_verified','node.startup_proof_rejected') ORDER BY seq DESC").all(nodeId);
    return orientedFromRows(rows);
}
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
export function buildOrientedMap(db) {
    const rows = db.prepare("SELECT node_id, type, payload, seq FROM events WHERE type IN ('node.startup_challenged','node.startup_proof_skipped','node.startup_proof_verified','node.startup_proof_rejected') ORDER BY node_id, seq DESC").all();
    const byNode = new Map();
    for (const r of rows) {
        let list = byNode.get(r.node_id);
        if (!list) {
            list = [];
            byNode.set(r.node_id, list);
        }
        list.push({ type: r.type, payload: r.payload, seq: r.seq });
    }
    const out = new Map();
    for (const [nodeId, nodeRows] of byNode)
        out.set(nodeId, orientedFromRows(nodeRows));
    return out;
}
//# sourceMappingURL=startup-proof.js.map