import { dirname } from "node:path";
/** Resolve the shipped general-purpose agent already installed with the daemon. */
export async function resolveDefaultAgentRef(client) {
    const res = await client.get("/api/specs/library?kind=agent");
    const entry = res.data?.find((candidate) => candidate.kind === "agent"
        && candidate.name === "orchestrator"
        && candidate.sourceType === "builtin");
    if (!entry) {
        throw new Error("The shipped default agent is unavailable. Reinstall OpenRig and retry.");
    }
    return `path:${dirname(entry.sourcePath)}`;
}
//# sourceMappingURL=topology-default-agent.js.map