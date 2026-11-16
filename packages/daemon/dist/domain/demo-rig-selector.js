export function selectCurrentRigSummary(rigs, rigName) {
    const matches = rigs.filter((entry) => entry.name === rigName);
    if (matches.length === 0) {
        return null;
    }
    const runningMatches = matches.filter((entry) => entry.status === "running");
    if (runningMatches.length === 1) {
        return runningMatches[0] ?? null;
    }
    if (runningMatches.length > 1) {
        throw new Error(`Rig '${rigName}' is ambiguous — ${runningMatches.length} running rigs share that name.`);
    }
    if (matches.length > 1) {
        throw new Error(`Rig '${rigName}' is ambiguous — ${matches.length} stopped rigs share that name and none are running.`);
    }
    return matches[0] ?? null;
}
export function filterNodesForRigId(nodes, rigId) {
    return nodes.filter((entry) => entry.rigId === rigId);
}
//# sourceMappingURL=demo-rig-selector.js.map