import { identityVerdictDownranksRunning } from "./types.js";
const VERTICAL_SPACING = 200;
export function projectRigToGraph(input, inventoryOverlay) {
    const { nodes: rigNodes, edges: rigEdges, sessions, pods = [] } = input;
    const overlayMap = new Map((inventoryOverlay ?? []).map((o) => [o.logicalId, o]));
    const podLabelById = new Map(pods.map((pod) => [pod.id, pod.label]));
    const podNamespaceById = new Map(pods.map((pod) => [pod.id, pod.namespace]));
    // Collect unique pods for group nodes
    const podNodes = new Map(); // podId → node IDs
    const nodes = rigNodes.map((node, index) => {
        // Find latest session for this node by ULID ordering (max session.id)
        const nodeSessions = sessions.filter((s) => s.nodeId === node.id);
        const latestSession = nodeSessions.length > 0
            ? nodeSessions.reduce((latest, s) => s.id > latest.id ? s : latest)
            : null;
        const overlay = overlayMap.get(node.logicalId);
        // OPR.0.4.3.19 forward-fix — a down-ranking identity verdict
        // (mismatch/pane_missing) makes the graph node's effective startup status
        // `attention_required`, so every UI surface that already treats
        // startupStatus==="attention_required" as non-green (the activity ring via
        // getBaselineActivityState, the ATTN badge) renders non-green WITHOUT a new
        // vocabulary. `getBaselineActivityState` checks attention_required BEFORE
        // terminalActive, so an orphan's tmux output can no longer paint the ring
        // active. The raw `status` stays the honest session-row value; the dot
        // (getActivityStateWithSource, which ignores startupStatus) is gated
        // separately in the UI via `identityVerdict`.
        const identityDownranked = identityVerdictDownranksRunning(overlay?.identityVerdict?.verdict);
        const effectiveStartupStatus = latestSession?.status === "running"
            ? (identityDownranked
                ? "attention_required"
                : (overlay?.startupStatus ?? latestSession.startupStatus ?? null))
            : null;
        // Track pods
        if (node.podId) {
            if (!podNodes.has(node.podId))
                podNodes.set(node.podId, []);
            podNodes.get(node.podId).push(node.id);
        }
        return {
            id: node.id,
            type: "rigNode",
            position: { x: 0, y: index * VERTICAL_SPACING },
            parentId: node.podId ? `pod-${node.podId}` : undefined,
            data: {
                logicalId: node.logicalId,
                podLabel: node.podId ? (podLabelById.get(node.podId) ?? null) : null,
                podNamespace: node.podId ? (podNamespaceById.get(node.podId) ?? null) : null,
                rigId: node.rigId,
                role: node.role,
                runtime: node.runtime,
                model: node.model,
                effort: node.effort ?? null,
                status: latestSession ? latestSession.status : null,
                binding: node.binding,
                nodeKind: node.runtime === "terminal" ? "infrastructure" : "agent",
                startupStatus: effectiveStartupStatus,
                canonicalSessionName: overlay?.canonicalSessionName ?? latestSession?.sessionName ?? null,
                podId: node.podId ?? null,
                restoreOutcome: overlay?.restoreOutcome ?? "n-a",
                oriented: overlay?.oriented ?? "n-a",
                resumeToken: latestSession?.resumeToken ?? null,
                resolvedSpecName: node.resolvedSpecName ?? null,
                profile: node.profile ?? null,
                edgeCount: rigEdges.filter((e) => e.sourceId === node.id || e.targetId === node.id).length,
                contextUsedPercentage: overlay?.contextUsedPercentage ?? null,
                contextFresh: overlay?.contextFresh ?? false,
                contextAvailability: overlay?.contextAvailability ?? "unknown",
                contextTotalInputTokens: overlay?.contextTotalInputTokens ?? null,
                contextTotalOutputTokens: overlay?.contextTotalOutputTokens ?? null,
                agentActivity: overlay?.agentActivity ?? null,
                currentQitems: overlay?.currentQitems ?? [],
                terminalActive: overlay?.terminalActive,
                hasAssignedWork: overlay?.hasAssignedWork ?? false,
                assignedWorkCount: overlay?.assignedWorkCount ?? 0,
                pendingWorkCount: overlay?.pendingWorkCount ?? 0,
                inProgressWorkCount: overlay?.inProgressWorkCount ?? 0,
                blockedWorkCount: overlay?.blockedWorkCount ?? 0,
                identityVerdict: overlay?.identityVerdict ?? null,
                heldReason: overlay?.heldReason ?? null,
            },
        };
    });
    // Create pod group nodes
    const groupNodes = [];
    for (const [podId] of podNodes) {
        groupNodes.push({
            id: `pod-${podId}`,
            type: "podGroup",
            position: { x: 0, y: 0 },
            data: {
                logicalId: podNamespaceById.get(podId) ?? podId,
                podLabel: podLabelById.get(podId) ?? podId,
                podNamespace: podNamespaceById.get(podId) ?? podId,
                rigId: input.rig.id,
                role: null,
                runtime: null,
                model: null,
                status: null,
                binding: null,
                nodeKind: "agent",
                startupStatus: null,
                canonicalSessionName: null,
                podId,
                restoreOutcome: "n-a",
                oriented: "n-a",
                resumeToken: null,
                resolvedSpecName: null,
                profile: null,
                edgeCount: 0,
                contextUsedPercentage: null,
                contextFresh: false,
                contextAvailability: "unknown",
                contextTotalInputTokens: null,
                contextTotalOutputTokens: null,
                agentActivity: null,
                currentQitems: [],
                terminalActive: null,
                hasAssignedWork: false,
                assignedWorkCount: 0,
                pendingWorkCount: 0,
                inProgressWorkCount: 0,
                blockedWorkCount: 0,
                identityVerdict: null,
                heldReason: null,
            },
        });
    }
    const edges = rigEdges.map((edge) => ({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        label: edge.kind,
    }));
    return { nodes: [...groupNodes, ...nodes], edges };
}
//# sourceMappingURL=graph-projection.js.map