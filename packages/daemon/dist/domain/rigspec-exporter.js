import { RigNotFoundError } from "./errors.js";
export class RigSpecExporter {
    db;
    rigRepo;
    sessionRegistry;
    podRepo;
    constructor(deps) {
        if (deps.rigRepo.db !== deps.sessionRegistry.db) {
            throw new Error("RigSpecExporter: rigRepo and sessionRegistry must share the same db handle");
        }
        if (deps.podRepo && deps.rigRepo.db !== deps.podRepo.db) {
            throw new Error("RigSpecExporter: podRepo must share the same db handle");
        }
        this.db = deps.rigRepo.db;
        this.rigRepo = deps.rigRepo;
        this.sessionRegistry = deps.sessionRegistry;
        this.podRepo = deps.podRepo ?? null;
    }
    exportRig(rigId) {
        const rig = this.rigRepo.getRig(rigId);
        if (!rig) {
            throw new RigNotFoundError(rigId);
        }
        // Detect pod-aware: any node has a non-null podId, or pods exist explicitly.
        const isPodAware = rig.nodes.some((n) => n.podId != null) || (this.podRepo?.getPodsForRig(rigId).length ?? 0) > 0;
        if (isPodAware && this.podRepo) {
            return this.exportPodAware(rigId, rig);
        }
        return this.exportLegacy(rigId, rig);
    }
    exportLegacy(rigId, rig) {
        // Get all sessions for restorePolicy lookup
        const sessions = this.sessionRegistry.getSessionsForRig(rigId);
        // Build a map: nodeId (DB PK) -> logical_id
        const idToLogical = new Map(rig.nodes.map((n) => [n.id, n.logicalId]));
        const nodes = rig.nodes.map((node) => {
            // Find latest session's restorePolicy for this node
            const nodeSessions = sessions
                .filter((s) => s.nodeId === node.id)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
            const latestSession = nodeSessions.length > 0
                ? nodeSessions[nodeSessions.length - 1]
                : null;
            const restorePolicy = latestSession?.restorePolicy
                ?? node.restorePolicy
                ?? undefined;
            if (!node.runtime) {
                throw new Error(`Cannot export node '${node.logicalId}': runtime is required but missing`);
            }
            const specNode = {
                id: node.logicalId,
                runtime: node.runtime,
            };
            if (node.role)
                specNode.role = node.role;
            if (node.model)
                specNode.model = node.model;
            if (node.effort)
                specNode.effort = node.effort;
            if (node.cwd)
                specNode.cwd = node.cwd;
            if (node.surfaceHint)
                specNode.surfaceHint = node.surfaceHint;
            if (node.workspace)
                specNode.workspace = node.workspace;
            if (restorePolicy)
                specNode.restorePolicy = restorePolicy;
            if (node.packageRefs && node.packageRefs.length > 0)
                specNode.packageRefs = node.packageRefs;
            return specNode;
        });
        const edges = rig.edges.map((edge) => {
            const from = idToLogical.get(edge.sourceId);
            if (!from) {
                throw new Error(`Cannot export edge: unmapped source node ID '${edge.sourceId}'`);
            }
            const to = idToLogical.get(edge.targetId);
            if (!to) {
                throw new Error(`Cannot export edge: unmapped target node ID '${edge.targetId}'`);
            }
            return { from, to, kind: edge.kind };
        });
        return {
            schemaVersion: 1,
            name: rig.rig.name,
            version: "0.1.0",
            nodes,
            edges,
        };
    }
    exportPodAware(rigId, rig) {
        const pods = this.podRepo.getPodsForRig(rigId);
        const sessions = this.sessionRegistry.getSessionsForRig(rigId);
        // Build maps for lookups
        // logicalId is "podSpecId.memberLocalId" — extract both parts
        const idToLogical = new Map(rig.nodes.map((n) => [n.id, n.logicalId]));
        const idToMemberLocal = new Map(rig.nodes.map((n) => [n.id, n.logicalId.includes(".") ? n.logicalId.split(".").slice(1).join(".") : n.logicalId]));
        const idToNode = new Map(rig.nodes.map((n) => [n.id, n]));
        const nodeIdToPodId = new Map(rig.nodes.map((n) => [n.id, n.podId]));
        // Group nodes by podId
        const nodesByPod = new Map();
        for (const node of rig.nodes) {
            if (node.podId) {
                const list = nodesByPod.get(node.podId) ?? [];
                list.push(node);
                nodesByPod.set(node.podId, list);
            }
        }
        // Helper: get restorePolicy for a node
        const getRestorePolicy = (nodeId) => {
            const nodeSessions = sessions
                .filter((s) => s.nodeId === nodeId)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
            const latest = nodeSessions.length > 0 ? nodeSessions[nodeSessions.length - 1] : null;
            return latest?.restorePolicy ?? idToNode.get(nodeId)?.restorePolicy ?? undefined;
        };
        // Build pod specs
        const podSpecs = pods.map((pod) => {
            const podNodes = nodesByPod.get(pod.id) ?? [];
            const memberNodeIds = new Set(podNodes.map((n) => n.id));
            const members = podNodes.map((node) => {
                if (!node.runtime) {
                    throw new Error(`Cannot export node '${node.logicalId}': runtime is required but missing`);
                }
                const member = {
                    id: idToMemberLocal.get(node.id) ?? node.logicalId,
                    agentRef: node.agentRef ?? "",
                    profile: node.profile ?? "default",
                    runtime: node.runtime,
                    cwd: node.cwd ?? ".",
                };
                if (node.label)
                    member.label = node.label;
                if (node.codexConfigProfile)
                    member.codexConfigProfile = node.codexConfigProfile;
                if (node.model)
                    member.model = node.model;
                if (node.effort)
                    member.effort = node.effort;
                // OPR.0.4.6.FAC1: a declared seat role exports with the pod
                // member (round-trip fidelity — export→import keeps the role).
                if (node.role)
                    member.role = node.role;
                // OPR.0.4.8.3 Seam B: the seat's RAW permission_policy ref round-trips
                // (export truth = the ref, never the resolved provenance).
                if (node.permissionPolicy)
                    member.permissionPolicy = node.permissionPolicy;
                if (node.env)
                    member.env = node.env;
                if (node.sessionSource)
                    member.sessionSource = node.sessionSource;
                const rp = getRestorePolicy(node.id);
                if (rp)
                    member.restorePolicy = rp;
                return member;
            });
            // Pod-local edges: both endpoints are in this pod
            const podEdges = rig.edges
                .filter((e) => memberNodeIds.has(e.sourceId) && memberNodeIds.has(e.targetId))
                .map((e) => ({
                kind: e.kind,
                from: idToMemberLocal.get(e.sourceId),
                to: idToMemberLocal.get(e.targetId),
            }));
            // Derive pod spec id from the first member's logicalId prefix (e.g., "dev" from "dev.impl")
            const podSpecId = pod.namespace;
            const podSpec = {
                id: podSpecId,
                label: pod.label,
                members,
                edges: podEdges,
            };
            if (pod.summary)
                podSpec.summary = pod.summary;
            if (pod.continuityPolicyJson) {
                try {
                    podSpec.continuityPolicy = JSON.parse(pod.continuityPolicyJson);
                }
                catch { /* skip if invalid JSON */ }
            }
            return podSpec;
        });
        // Cross-pod edges: endpoints in different pods
        // logicalId is already "podSpecId.memberLocalId" — use directly as qualified ref
        const crossPodEdges = rig.edges
            .filter((e) => {
            const srcPod = nodeIdToPodId.get(e.sourceId);
            const tgtPod = nodeIdToPodId.get(e.targetId);
            return srcPod && tgtPod && srcPod !== tgtPod;
        })
            .map((e) => ({
            kind: e.kind,
            from: idToLogical.get(e.sourceId),
            to: idToLogical.get(e.targetId),
        }));
        // OPR.0.4.8.3 Seam B: rig-level permission_policy is a RIG-ROW field (not derivable
        // from the spec re-emit) — explicit repository read, emitted only when set.
        const rigPermissionPolicy = this.rigRepo.getRigPermissionPolicy(rigId);
        const workspace = this.rigRepo.getRigWorkspace(rigId);
        const rigEnv = this.rigRepo.getRigEnv(rigId);
        // #25: the selected Claude managed-block file is also a rig-row field.
        const claudeManagedBlockFile = this.rigRepo.getRigClaudeManagedBlockFile(rigId);
        return {
            version: "0.2",
            name: rig.rig.name,
            ...(rigPermissionPolicy ? { permissionPolicy: rigPermissionPolicy } : {}),
            ...(this.rigRepo.getRigNonInterruptive(rigId) ? { nonInterruptive: true } : {}),
            ...(rigEnv ? { env: rigEnv } : {}),
            ...(claudeManagedBlockFile ? { managedBlocks: { "claude-code": claudeManagedBlockFile } } : {}),
            ...(workspace ? { workspace } : {}),
            pods: podSpecs,
            edges: crossPodEdges,
        };
    }
}
//# sourceMappingURL=rigspec-exporter.js.map