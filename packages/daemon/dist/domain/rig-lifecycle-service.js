import { findOtherSessionOwner } from "./session-owner.js";
import { DeliveryGuardError } from "./seat-delivery-guard.js";
export class RigLifecycleService {
    db;
    rigRepo;
    sessionRegistry;
    discoveryRepo;
    eventBus;
    queueRepo;
    tmuxAdapter;
    constructor(deps) {
        if (deps.db !== deps.rigRepo.db)
            throw new Error("RigLifecycleService: rigRepo must share the same db handle");
        if (deps.db !== deps.sessionRegistry.db)
            throw new Error("RigLifecycleService: sessionRegistry must share the same db handle");
        if (deps.db !== deps.discoveryRepo.db)
            throw new Error("RigLifecycleService: discoveryRepo must share the same db handle");
        if (deps.db !== deps.eventBus.db)
            throw new Error("RigLifecycleService: eventBus must share the same db handle");
        if (deps.db !== deps.queueRepo.db)
            throw new Error("RigLifecycleService: queueRepo must share the same db handle");
        this.db = deps.db;
        this.rigRepo = deps.rigRepo;
        this.sessionRegistry = deps.sessionRegistry;
        this.discoveryRepo = deps.discoveryRepo;
        this.eventBus = deps.eventBus;
        this.queueRepo = deps.queueRepo;
        this.tmuxAdapter = deps.tmuxAdapter ?? null;
    }
    /** Release a current claimed session without killing its external process. */
    async unclaimSession(sessionRef) {
        const exactId = this.db.prepare(`
      SELECT s.id AS session_id, s.session_name, n.id AS node_id, n.rig_id, n.logical_id, b.tmux_session
      FROM sessions s
      JOIN nodes n ON n.id = s.node_id
      LEFT JOIN bindings b ON b.node_id = n.id
      WHERE s.id = ?
        AND s.origin = 'claimed'
      LIMIT 1
    `).get(sessionRef);
        const matches = exactId
            ? [exactId]
            : this.db.prepare(`
          SELECT s.id AS session_id, s.session_name, n.id AS node_id, n.rig_id, n.logical_id, b.tmux_session
          FROM sessions s
          JOIN nodes n ON n.id = s.node_id
          LEFT JOIN bindings b ON b.node_id = n.id
          WHERE s.session_name = ?
            AND s.origin = 'claimed'
          ORDER BY s.created_at DESC, s.id DESC
        `).all(sessionRef);
        if (matches.length === 0) {
            return { ok: false, code: "session_not_found", error: `Claimed session '${sessionRef}' not found.` };
        }
        if (!exactId && matches.length > 1) {
            return {
                ok: false,
                code: "session_ambiguous",
                error: `Session '${sessionRef}' is ambiguous. Use the session ID instead.`,
            };
        }
        const session = matches[0];
        const guard = this.tmuxAdapter?.deliveryGuard;
        const success = {
            ok: true, rigId: session.rig_id, nodeId: session.node_id, logicalId: session.logical_id,
            sessionId: session.session_id, sessionName: session.session_name,
        };
        const isReleased = () => {
            const latest = this.db.prepare("SELECT status FROM sessions WHERE node_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").get(session.node_id);
            return !this.sessionRegistry.getBindingForNode(session.node_id) && latest?.status === "detached";
        };
        const releasedRetry = isReleased();
        if (!releasedRetry && guard && !guard.ownsCustody(session.node_id)) {
            return guard.custody([session.node_id], () => this.unclaimSession(session.session_id));
        }
        /** Read fresh custody both before metadata cleanup and at the detach commit. */
        const isCurrent = () => {
            const latest = this.db.prepare("SELECT id FROM sessions WHERE node_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").get(session.node_id);
            const binding = this.sessionRegistry.getBindingForNode(session.node_id);
            return latest?.id === session.session_id
                && (!binding?.tmuxSession || binding.tmuxSession === session.session_name);
        };
        if (!releasedRetry && !isCurrent()) {
            return {
                ok: false,
                code: "session_not_current",
                error: `Claimed session '${session.session_id}' no longer owns this seat. No metadata or custody was changed.`,
            };
        }
        // Best-effort: clear OpenRig-owned tmux metadata from the adopted session.
        if (!releasedRetry && this.tmuxAdapter && session.tmux_session) {
            const keys = [
                "@rigged_node_id",
                "@rigged_session_name",
                "@rigged_rig_id",
                "@rigged_rig_name",
                "@rigged_logical_id",
            ];
            for (const key of keys) {
                try {
                    await this.tmuxAdapter.setSessionOption(session.tmux_session, key, "");
                }
                catch {
                    // best-effort only
                }
            }
        }
        let persistedSeq = 0;
        let persistedAt = "";
        const tx = this.db.transaction(() => {
            if (releasedRetry ? !isReleased() : !isCurrent())
                return false;
            this.sessionRegistry.markDetached(session.session_id);
            if (!releasedRetry) {
                this.sessionRegistry.clearBinding(session.node_id);
                this.discoveryRepo.releaseClaimByNodeId(session.node_id);
            }
            const event = this.eventBus.persistWithinTransaction({
                type: "session.detached",
                rigId: session.rig_id,
                nodeId: session.node_id,
                sessionName: session.session_name,
            });
            persistedSeq = event.seq;
            persistedAt = event.createdAt;
            return true;
        });
        if (!tx()) {
            return {
                ok: false,
                code: "session_not_current",
                error: `Claimed session '${session.session_id}' no longer owns this seat. Database custody was not changed. OpenRig tmux metadata on '${session.tmux_session ?? session.session_name}' may already have been cleared.`,
            };
        }
        this.eventBus.notifySubscribers({
            type: "session.detached",
            rigId: session.rig_id,
            nodeId: session.node_id,
            sessionName: session.session_name,
            seq: persistedSeq,
            createdAt: persistedAt,
        });
        return success;
    }
    /** Release adopted seats under their lifecycle leases, optionally deleting the rig. */
    async releaseRig(rigId, opts) {
        const rig = this.rigRepo.getRig(rigId);
        if (!rig) {
            return { ok: false, code: "rig_not_found", error: `Rig '${rigId}' not found.` };
        }
        const readRows = () => this.db.prepare(`
      SELECT
        n.id AS node_id,
        n.logical_id,
        s.id AS session_id,
        s.session_name,
        s.origin AS session_origin,
        s.status AS session_status,
        b.tmux_session
      FROM nodes n
      LEFT JOIN bindings b ON b.node_id = n.id
      LEFT JOIN sessions s ON s.id = (
        SELECT s2.id
        FROM sessions s2
        WHERE s2.node_id = n.id
        ORDER BY s2.created_at DESC, s2.id DESC
        LIMIT 1
      )
      WHERE n.rig_id = ?
      ORDER BY n.logical_id
    `).all(rigId);
        const rows = readRows();
        const launchedLogicalIds = rows
            .filter((row) => row.session_id && row.session_origin === "launched")
            .map((row) => row.logical_id);
        if (launchedLogicalIds.length > 0) {
            return {
                ok: false,
                code: "contains_launched_nodes",
                error: "Rig contains launched nodes and cannot be released safely. Use rig down for OpenRig-launched rigs.",
                launchedLogicalIds,
            };
        }
        const targets = opts?.delete ? rows : rows.filter(row => row.session_origin === "claimed");
        const leaseTargets = opts?.delete ? targets : targets.filter(row => row.session_status !== "detached" || row.tmux_session !== null);
        const changed = new Map();
        const matches = (target, row) => !!row
            && row.session_id === target.session_id && row.session_name === target.session_name
            && row.session_origin === target.session_origin && row.logical_id === target.logical_id
            && row.session_status === target.session_status && row.tmux_session === target.tmux_session;
        const release = async () => {
            const current = new Map(readRows().map(row => [row.node_id, row]));
            for (const target of targets) {
                if (!matches(target, current.get(target.node_id)))
                    changed.set(target.node_id, "Release target changed while waiting; no cleanup performed for this seat.");
            }
            if (opts?.delete && (current.size !== rows.length || changed.size > 0)) {
                throw new DeliveryGuardError("guard_target_changed", "Release target changed while waiting; no cleanup performed.");
            }
            const released = [];
            const failed = [];
            for (const row of targets) {
                if (!row.session_id || row.session_origin !== "claimed")
                    continue;
                // Unleased detached seats may be reclaimed while another seat is cleaned.
                if (!matches(row, readRows().find(current => current.node_id === row.node_id))) {
                    changed.set(row.node_id, "Release target changed; no cleanup performed for this seat.");
                }
                const error = changed.get(row.node_id);
                if (error) {
                    failed.push({ nodeId: row.node_id, logicalId: row.logical_id, sessionId: row.session_id, sessionName: row.session_name, error });
                    continue;
                }
                const result = await this.unclaimSession(row.session_id).catch((error) => {
                    if (!(error instanceof DeliveryGuardError))
                        throw error;
                    return { ok: false, error: error.message };
                });
                if (result.ok) {
                    released.push({
                        nodeId: result.nodeId,
                        logicalId: result.logicalId,
                        sessionId: result.sessionId,
                        sessionName: result.sessionName,
                    });
                }
                else {
                    failed.push({
                        nodeId: row.node_id,
                        logicalId: row.logical_id,
                        sessionId: row.session_id,
                        sessionName: row.session_name,
                        error: result.error,
                    });
                }
            }
            let deleted = false;
            if (failed.length === 0 && opts?.delete) {
                let persistedSeq = 0;
                let persistedAt = "";
                const tx = this.db.transaction(() => {
                    const current = readRows();
                    const conflicts = current.filter(row => !rows.some(captured => captured.node_id === row.node_id && captured.session_id === row.session_id));
                    const missing = rows.filter(captured => !current.some(row => row.node_id === captured.node_id));
                    if (conflicts.length > 0 || missing.length > 0) {
                        for (const row of [...conflicts, ...missing]) {
                            const captured = rows.find(target => target.node_id === row.node_id);
                            failed.push({ nodeId: row.node_id, logicalId: row.logical_id,
                                sessionId: captured?.session_id ?? null, sessionName: captured?.session_name ?? null,
                                error: "Rig membership or session changed during cleanup; rig was not deleted.",
                            });
                        }
                        return false;
                    }
                    const event = this.eventBus.persistWithinTransaction({
                        type: "rig.deleted",
                        rigId,
                    });
                    persistedSeq = event.seq;
                    persistedAt = event.createdAt;
                    this.rigRepo.deleteRig(rigId);
                    return true;
                });
                if (tx()) {
                    this.eventBus.notifySubscribers({
                        type: "rig.deleted",
                        rigId,
                        seq: persistedSeq,
                        createdAt: persistedAt,
                    });
                    deleted = true;
                }
            }
            return {
                ok: true,
                status: failed.length > 0 ? "partial" : "ok",
                rigId,
                deleted,
                released,
                failed,
            };
        };
        const guard = this.tmuxAdapter?.deliveryGuard;
        return guard ? guard.custody(leaseTargets.map(row => row.node_id), release, opts?.delete ? undefined : (nodeId, error) => { changed.set(nodeId, error.message); }) : release();
    }
    async removeNode(rigId, nodeRef, opts) {
        return this.removeNodeWithin(rigId, nodeRef, opts?.fallbackDestination, null);
    }
    /**
     * `shrinkTarget` is set when a pod shrink removes its members: the shrink has already validated the
     * fallback once for the whole pod, so a member revalidates it only when its own work needs rerouting.
     */
    async removeNodeWithin(rigId, nodeRef, fallbackDestination, shrinkTarget) {
        const rig = this.rigRepo.getRig(rigId);
        if (!rig) {
            return { ok: false, code: "rig_not_found", error: `Rig '${rigId}' not found.` };
        }
        const node = this.resolveNodeRef(rigId, nodeRef);
        if (!node) {
            return { ok: false, code: "node_not_found", error: `Node '${nodeRef}' not found in rig '${rigId}'.` };
        }
        const guard = this.tmuxAdapter?.deliveryGuard;
        if (guard && !guard.ownsLifecycle(node.node_id)) {
            return guard.lifecycle([node.node_id], () => this.removeNodeWithin(rigId, nodeRef, fallbackDestination, shrinkTarget));
        }
        const targetNodeIds = shrinkTarget ?? new Set([node.node_id]);
        if (fallbackDestination !== undefined && !shrinkTarget) {
            const invalidFallback = await this.validateFallbackDestination(fallbackDestination, targetNodeIds);
            if (invalidFallback)
                return invalidFallback;
        }
        // #174: a session name can be reused by another rig's live seat (for example an archived duplicate
        // of a live rig). When another unarchived node owns the name, that session and the queue work
        // addressed to it are the other seat's: removal neither kills it nor routes its work. Owners in
        // archived rigs don't count, since archiving keeps their stale bindings.
        const sessionOwner = node.latest_session_name
            ? findOtherSessionOwner(this.db, node.latest_session_name, node.node_id, { ignoreArchived: true })
            : null;
        const addressedSessions = node.latest_session_name && !sessionOwner ? [node.latest_session_name] : [];
        const activeQitemIds = this.activeQitemIdsForSessionNames(addressedSessions);
        if (activeQitemIds.length > 0 && fallbackDestination === undefined) {
            return {
                ok: false,
                code: "active_qitems",
                activeQitemIds,
                error: this.activeQitemsError(`Node '${node.logical_id}' still has active queue work addressed to '${node.latest_session_name}'.`, activeQitemIds, "removing the node"),
            };
        }
        if (fallbackDestination !== undefined && activeQitemIds.length > 0) {
            // A pod member's work arrived after the pod-level check, so its fallback is checked again before use.
            const invalidFallback = shrinkTarget ? await this.validateFallbackDestination(fallbackDestination, targetNodeIds) : null;
            if (invalidFallback)
                return { ...invalidFallback, activeQitemIds };
            for (const qitemId of activeQitemIds) {
                this.queueRepo.routeToFallback(qitemId, fallbackDestination, `explicit fallback while removing node ${node.logical_id}`);
            }
        }
        const preserveDetachedClaimedSession = node.latest_session_origin === "claimed" && node.latest_session_status === "detached";
        const keepSession = preserveDetachedClaimedSession || sessionOwner !== null;
        const sessionStopped = !keepSession && Boolean(node.latest_session_name);
        let sessionsKilled = 0;
        if (node.latest_session_name && !keepSession) {
            const kill = await this.tmuxAdapter?.killSession(node.latest_session_name);
            if (kill && !kill.ok && kill.code !== "session_not_found") {
                return {
                    ok: false,
                    code: "kill_failed",
                    error: `Failed to kill session '${node.latest_session_name}': ${kill.message}`,
                    fallbackDestination,
                    reroutedQitemIds: activeQitemIds,
                };
            }
            sessionsKilled = !kill || kill.ok ? 1 : 0;
        }
        // Queue writes can be accepted while tmux termination awaits, even while this operation owns the
        // seat's lifecycle lease. Late work goes to the same fallback once it is confirmed still running;
        // the topology transaction then checks again and keeps the node if any work remains.
        let lateFallbackFailure = null;
        const lateQitemIds = this.activeQitemIdsForSessionNames(addressedSessions);
        if (fallbackDestination !== undefined && lateQitemIds.length > 0) {
            lateFallbackFailure = await this.validateFallbackDestination(fallbackDestination, targetNodeIds);
            if (!lateFallbackFailure) {
                for (const qitemId of lateQitemIds) {
                    this.queueRepo.routeToFallback(qitemId, fallbackDestination, `explicit fallback while removing node ${node.logical_id}`);
                    if (!activeQitemIds.includes(qitemId))
                        activeQitemIds.push(qitemId);
                }
            }
        }
        const persisted = [];
        let rosterEvent = null;
        const tx = this.db.transaction(() => {
            const remaining = this.activeQitemIdsForSessionNames(addressedSessions);
            if (remaining.length > 0 && sessionStopped && node.latest_session_id) {
                this.sessionRegistry.markIntentionallyStopped(node.latest_session_id);
                this.sessionRegistry.clearBinding(node.node_id);
            }
            if (node.latest_session_name && !keepSession) {
                const detached = this.eventBus.persistWithinTransaction({
                    type: "session.detached",
                    rigId,
                    nodeId: node.node_id,
                    sessionName: node.latest_session_name,
                });
                persisted.push({ type: "session.detached", seq: detached.seq, createdAt: detached.createdAt });
            }
            if (remaining.length > 0)
                return remaining;
            const removed = this.eventBus.persistWithinTransaction({
                type: "node.removed",
                rigId,
                nodeId: node.node_id,
            });
            persisted.push({ type: "node.removed", seq: removed.seq, createdAt: removed.createdAt });
            this.rigRepo.deleteNode(node.node_id);
            rosterEvent = this.eventBus.persistWithinTransaction({
                type: "topology.roster_recorded",
                rigId,
                intendedNodeIds: this.rigRepo.getRig(rigId)?.nodes.map((candidate) => candidate.id) ?? [],
                source: "materialized_topology",
            });
            return [];
        });
        const remaining = tx();
        for (const event of persisted) {
            if (event.type === "session.detached" && node.latest_session_name) {
                this.eventBus.notifySubscribers({
                    type: "session.detached",
                    rigId,
                    nodeId: node.node_id,
                    sessionName: node.latest_session_name,
                    seq: event.seq,
                    createdAt: event.createdAt,
                });
            }
            if (event.type === "node.removed") {
                this.eventBus.notifySubscribers({
                    type: "node.removed",
                    rigId,
                    nodeId: node.node_id,
                    seq: event.seq,
                    createdAt: event.createdAt,
                });
            }
        }
        if (rosterEvent)
            this.eventBus.notifySubscribers(rosterEvent);
        if (remaining.length > 0) {
            const subject = lateFallbackFailure
                ? `Fallback destination '${fallbackDestination}' is no longer a running seat, so queue work that arrived while removing node '${node.logical_id}' was not rerouted and the node was kept.`
                : `Node '${node.logical_id}' received active queue work during removal and was kept.`;
            const stopped = sessionStopped ? ` Its session '${node.latest_session_name}' was stopped and stays stopped.` : "";
            const rerouted = activeQitemIds.length > 0
                ? ` Already rerouted to '${fallbackDestination}': ${activeQitemIds.join(", ")}.`
                : "";
            return {
                ok: false,
                code: lateFallbackFailure?.code ?? "active_qitems",
                activeQitemIds: remaining,
                fallbackDestination,
                reroutedQitemIds: activeQitemIds,
                sessionsKilled,
                retained: true,
                sessionStopped,
                error: this.activeQitemsError(`${subject}${stopped}${rerouted}`, remaining),
            };
        }
        return {
            ok: true,
            rigId,
            nodeId: node.node_id,
            logicalId: node.logical_id,
            sessionsKilled,
            ...(sessionOwner ? { sessionKeptFor: `${sessionOwner.logical_id}@${sessionOwner.rig_name}` } : {}),
            ...(fallbackDestination !== undefined ? { fallbackDestination } : {}),
            reroutedQitemIds: activeQitemIds,
        };
    }
    async shrinkPod(rigId, podRef, opts) {
        const rig = this.rigRepo.getRig(rigId);
        if (!rig) {
            return { ok: false, code: "rig_not_found", error: `Rig '${rigId}' not found.` };
        }
        const pod = this.resolvePodRef(rigId, podRef);
        if (!pod) {
            return { ok: false, code: "pod_not_found", error: `Pod '${podRef}' not found in rig '${rigId}'.` };
        }
        const nodes = this.db.prepare(`
      SELECT n.id, n.logical_id,
        (SELECT s.session_name FROM sessions s WHERE s.node_id = n.id ORDER BY s.created_at DESC, s.id DESC LIMIT 1) AS latest_session_name
      FROM nodes n
      WHERE n.rig_id = ? AND n.pod_id = ?
      ORDER BY n.logical_id
    `).all(rigId, pod.id);
        const guard = this.tmuxAdapter?.deliveryGuard;
        const ids = nodes.map(node => node.id);
        if (guard && ids.some(id => !guard.ownsLifecycle(id)))
            return guard.lifecycle(ids, () => this.shrinkPod(rigId, podRef, opts));
        const fallbackDestination = opts?.fallbackDestination;
        if (fallbackDestination !== undefined) {
            const invalidFallback = await this.validateFallbackDestination(fallbackDestination, new Set(nodes.map((node) => node.id)));
            if (invalidFallback)
                return invalidFallback;
        }
        // #141: the same ownership rule as removeNode, applied to the whole shrink target. A member's session name
        // that an unarchived node OUTSIDE the target owns (for example the live replacement of an archived
        // generation) addresses that node's work, which this shrink neither counts nor reroutes. Another member of
        // the target sharing the name doesn't take the name's work out of this check.
        const activeQitemIds = this.activeQitemIdsForSessionNames(nodes.flatMap((node) => node.latest_session_name
            && !findOtherSessionOwner(this.db, node.latest_session_name, node.id, { ignoreArchived: true, excludeNodeIds: ids })
            ? [node.latest_session_name] : []));
        if (activeQitemIds.length > 0 && fallbackDestination === undefined) {
            return {
                ok: false,
                code: "active_qitems",
                activeQitemIds,
                error: this.activeQitemsError(`Pod '${pod.namespace}' still has active queue work addressed to members being removed.`, activeQitemIds),
            };
        }
        if (fallbackDestination !== undefined) {
            for (const qitemId of activeQitemIds) {
                this.queueRepo.routeToFallback(qitemId, fallbackDestination, `explicit fallback while shrinking pod ${pod.namespace}`);
            }
        }
        let sessionsKilled = 0;
        const removedLogicalIds = [];
        const nodeOutcomes = [];
        for (const node of nodes) {
            const removed = await this.removeNodeWithin(rigId, node.id, fallbackDestination, new Set(ids));
            for (const qitemId of removed.reroutedQitemIds ?? []) {
                if (!activeQitemIds.includes(qitemId))
                    activeQitemIds.push(qitemId);
            }
            if (!removed.ok) {
                sessionsKilled += removed.sessionsKilled ?? 0;
                const code = removed.code === "node_not_found" ? "kill_failed" : removed.code;
                const memberError = removed.code === "node_not_found"
                    ? `Node '${node.logical_id}' disappeared while shrinking pod '${pod.namespace}'.`
                    : removed.error;
                const error = this.withShrinkEffects(memberError, pod.namespace, {
                    fallbackDestination, reroutedQitemIds: activeQitemIds, removedLogicalIds, sessionsKilled,
                });
                nodeOutcomes.push({
                    nodeId: node.id,
                    logicalId: node.logical_id,
                    status: "failed",
                    sessionsKilled: removed.sessionsKilled ?? 0,
                    code: removed.code,
                    ...(removed.retained ? { retained: true, sessionStopped: removed.sessionStopped ?? false } : {}),
                    ...(removed.activeQitemIds ? { activeQitemIds: removed.activeQitemIds } : {}),
                    error,
                });
                if (removedLogicalIds.length > 0) {
                    return {
                        ok: true,
                        status: "partial",
                        rigId,
                        podId: pod.id,
                        namespace: pod.namespace,
                        removedLogicalIds,
                        sessionsKilled,
                        fallbackDestination,
                        reroutedQitemIds: activeQitemIds,
                        nodes: nodeOutcomes,
                    };
                }
                return {
                    ok: false,
                    code,
                    error,
                    ...(removed.activeQitemIds ? { activeQitemIds: removed.activeQitemIds } : {}),
                    fallbackDestination,
                    reroutedQitemIds: activeQitemIds,
                    sessionsKilled,
                    nodes: nodeOutcomes,
                };
            }
            sessionsKilled += removed.sessionsKilled;
            removedLogicalIds.push(removed.logicalId);
            nodeOutcomes.push({
                nodeId: removed.nodeId,
                logicalId: removed.logicalId,
                status: "removed",
                sessionsKilled: removed.sessionsKilled,
                ...(removed.sessionKeptFor ? { sessionKeptFor: removed.sessionKeptFor } : {}),
            });
        }
        let persistedSeq = 0;
        let persistedAt = "";
        const tx = this.db.transaction(() => {
            const event = this.eventBus.persistWithinTransaction({
                type: "pod.deleted",
                rigId,
                podId: pod.id,
            });
            persistedSeq = event.seq;
            persistedAt = event.createdAt;
            this.db.prepare("DELETE FROM pods WHERE id = ?").run(pod.id);
        });
        tx();
        this.eventBus.notifySubscribers({
            type: "pod.deleted",
            rigId,
            podId: pod.id,
            seq: persistedSeq,
            createdAt: persistedAt,
        });
        return {
            ok: true,
            status: "ok",
            rigId,
            podId: pod.id,
            namespace: pod.namespace,
            removedLogicalIds,
            sessionsKilled,
            ...(fallbackDestination !== undefined ? { fallbackDestination } : {}),
            reroutedQitemIds: activeQitemIds,
            nodes: nodeOutcomes,
        };
    }
    /** A member failure during a shrink, restated so it doesn't deny effects the shrink already applied. */
    withShrinkEffects(memberError, namespace, effects) {
        const applied = [];
        if (effects.reroutedQitemIds.length > 0) {
            applied.push(`rerouted ${effects.reroutedQitemIds.join(", ")} to '${effects.fallbackDestination}'`);
        }
        if (effects.removedLogicalIds.length > 0)
            applied.push(`removed ${effects.removedLogicalIds.join(", ")}`);
        if (effects.sessionsKilled > 0)
            applied.push(`stopped ${effects.sessionsKilled} session(s)`);
        if (applied.length === 0)
            return memberError;
        const error = memberError.replace(" No queue or topology changes were made.", "");
        return `${error}
Shrinking pod '${namespace}' already ${applied.join("; ")}; those changes were not undone.`;
    }
    activeQitemIdsForSessionNames(sessionNames) {
        const uniqueSessionNames = [...new Set(sessionNames)];
        if (uniqueSessionNames.length === 0)
            return [];
        const placeholders = uniqueSessionNames.map(() => "?").join(", ");
        return this.db.prepare(`
      SELECT qitem_id
      FROM queue_items
      WHERE destination_session IN (${placeholders})
        AND state IN ('pending', 'in-progress', 'blocked')
      ORDER BY qitem_id
    `).all(...uniqueSessionNames).map((row) => row.qitem_id);
    }
    activeQitemsError(subject, activeQitemIds, before = "removal") {
        const fallbackCommands = activeQitemIds
            .map((qitemId) => `rig queue fallback ${qitemId} --destination <live-seat>`)
            .join("\n");
        return `${subject} Reroute each qitem before ${before}:\n${fallbackCommands}`;
    }
    async validateFallbackDestination(fallbackDestination, targetNodeIds) {
        const row = this.db.prepare(`
      SELECT s.node_id, n.logical_id, s.status
      FROM sessions s
      JOIN nodes n ON n.id = s.node_id
      WHERE s.session_name = ?
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 1
    `).get(fallbackDestination);
        if (!row || row.status !== "running") {
            return {
                ok: false,
                code: "fallback_not_running",
                error: `Fallback destination '${fallbackDestination}' is not a currently running seat. No queue or topology changes were made.`,
            };
        }
        if (targetNodeIds.has(row.node_id)) {
            return {
                ok: false,
                code: "fallback_in_target",
                error: `Fallback destination '${fallbackDestination}' belongs to '${row.logical_id}', which is part of the removal target. No queue or topology changes were made.`,
            };
        }
        if (!this.tmuxAdapter || !(await this.tmuxAdapter.hasSession(fallbackDestination))) {
            return {
                ok: false,
                code: "fallback_not_running",
                error: `Fallback destination '${fallbackDestination}' is not a currently running seat. No queue or topology changes were made.`,
            };
        }
        return null;
    }
    resolveNodeRef(rigId, nodeRef) {
        const exactId = this.db.prepare(`
      SELECT n.id AS node_id, n.rig_id, n.logical_id, n.pod_id, b.tmux_session,
        s.id AS latest_session_id,
        s.session_name AS latest_session_name,
        s.status AS latest_session_status,
        s.origin AS latest_session_origin
      FROM nodes n
      LEFT JOIN bindings b ON b.node_id = n.id
      LEFT JOIN sessions s ON s.id = (
        SELECT s2.id FROM sessions s2 WHERE s2.node_id = n.id ORDER BY s2.created_at DESC, s2.id DESC LIMIT 1
      )
      WHERE n.rig_id = ? AND n.id = ?
      LIMIT 1
    `).get(rigId, nodeRef);
        if (exactId)
            return exactId;
        const byLogicalId = this.db.prepare(`
      SELECT n.id AS node_id, n.rig_id, n.logical_id, n.pod_id, b.tmux_session,
        s.id AS latest_session_id,
        s.session_name AS latest_session_name,
        s.status AS latest_session_status,
        s.origin AS latest_session_origin
      FROM nodes n
      LEFT JOIN bindings b ON b.node_id = n.id
      LEFT JOIN sessions s ON s.id = (
        SELECT s2.id FROM sessions s2 WHERE s2.node_id = n.id ORDER BY s2.created_at DESC, s2.id DESC LIMIT 1
      )
      WHERE n.rig_id = ? AND n.logical_id = ?
      LIMIT 1
    `).get(rigId, nodeRef);
        return byLogicalId ?? null;
    }
    resolvePodRef(rigId, podRef) {
        const exactId = this.db.prepare(`
      SELECT id, namespace
      FROM pods
      WHERE rig_id = ? AND id = ?
      LIMIT 1
    `).get(rigId, podRef);
        if (exactId)
            return exactId;
        const byNamespace = this.db.prepare(`
      SELECT id, namespace
      FROM pods
      WHERE rig_id = ? AND namespace = ?
      LIMIT 1
    `).get(rigId, podRef);
        return byNamespace ?? null;
    }
}
//# sourceMappingURL=rig-lifecycle-service.js.map