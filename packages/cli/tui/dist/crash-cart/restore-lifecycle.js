/** Adapt a lifecycle frame into the render VM. The triage list is the UNION of two honest sources,
 *  each carrying its EXACT need on its own row (never a clipped one-line summary): the per-seat
 *  attention rows (Claude picker / Codex auth / awaiting-decision), red; and the not_attempted rigs
 *  that carry a remediation (no usable snapshot / cancelled), yellow (a caveat, not a failed seat). */
export function buildRestoreLifecycleVM(frame) {
    const attentionRows = frame.rollup.attention_required.map((a) => ({
        seat: `${a.seat}@${a.rigId}`,
        check: "resume",
        status: "red",
        need: a.need,
        evidence: a.need,
        remediationSafe: false,
    }));
    const notAttemptedRows = frame.rollup.sequence
        .filter((r) => r.outcome === "not_attempted" && (r.remediation || r.reason))
        .map((r) => ({
        seat: r.rigId,
        check: "snapshot",
        status: "yellow",
        need: r.remediation ?? r.reason ?? "not attempted",
        evidence: r.reason ?? "",
        remediationSafe: false,
    }));
    return {
        phase: frame.phase,
        cancelled: frame.cancelled,
        verdict: frame.verdict,
        counts: frame.rollup.counts,
        progress: frame.rollup.sequence.map((r) => ({ rigId: r.rigId, outcome: r.outcome })),
        triage: [...attentionRows, ...notAttemptedRows],
        attemptId: frame.attemptId,
    };
}
/** Drive one fleet restore from the TUI: kick (or reattach), retain the attempt id, poll emitting a
 *  frame each time (mid-run observable), request cancel when the operator asks, resolve on done. Two
 *  guarantees the operator lifecycle depends on:
 *   - a TRANSIENT poll error never ends the lifecycle — it is tolerated and retried; only
 *     `maxConsecutiveErrors` in a row (a genuinely unreachable daemon) DETACHES.
 *   - reaching the poll ceiling DETACHES (phase "detached"), it does NOT return a frozen "running"
 *     frame — so the caller never renders a live-looking screen whose cancel key is dead. A detached
 *     frame is an explicit, operable state: the caller reattaches or cancels by the retained id. */
export async function driveRestoreLifecycle(deps) {
    const fleetAttemptId = deps.attemptId ?? (await deps.client.restoreFleet()).fleetAttemptId;
    const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    const interval = deps.pollIntervalMs ?? 400;
    const maxPolls = deps.maxPolls ?? 4500; // generous — a real fleet restore is bounded by daemon work
    const maxConsecutiveErrors = deps.maxConsecutiveErrors ?? 5;
    let cancelSent = false;
    let consecutiveErrors = 0;
    let last;
    const detached = () => ({
        ...(last ?? { done: false, cancelled: false, verdict: "none_attempted", rollup: { counts: { fully_restored: 0, partially_restored: 0, failed: 0, not_attempted: 0 }, sequence: [], attention_required: [] } }),
        done: false,
        attemptId: fleetAttemptId,
        phase: "detached",
    });
    for (let i = 0; i < maxPolls; i++) {
        if (deps.isCancelRequested() && !cancelSent) {
            cancelSent = true;
            try {
                await deps.client.cancelRestoreFleet(fleetAttemptId); // reach the endpoint that exists
            }
            catch {
                cancelSent = false; // a failed cancel POST may retry next tick (never swallow the operator's intent)
            }
        }
        let status;
        try {
            status = await deps.client.restoreFleetStatus(fleetAttemptId);
            consecutiveErrors = 0; // a good poll clears the transient-error streak
        }
        catch {
            // TRANSIENT poll failure (r1 refinement 2): tolerate, DO NOT end the lifecycle on one. Only a
            // sustained streak (a genuinely unreachable daemon) detaches to the operable reattach state.
            if (++consecutiveErrors >= maxConsecutiveErrors) {
                const frame = detached();
                deps.onFrame(frame);
                return frame;
            }
            await sleep(interval);
            continue;
        }
        const frame = { ...status, attemptId: fleetAttemptId, phase: status.done ? "done" : "running" };
        deps.onFrame(frame); // a frame EVERY poll — the operator sees progress before completion
        last = status;
        if (status.done)
            return frame;
        await sleep(interval);
    }
    // Poll ceiling: DETACH (never a frozen "running" frame — r1 refinement 1). The restore continues on
    // the daemon; the caller offers reattach / cancel-by-id from this explicit state.
    const frame = detached();
    deps.onFrame(frame);
    return frame;
}
//# sourceMappingURL=restore-lifecycle.js.map