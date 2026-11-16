import { RigSpecCodec } from "./rigspec-codec.js";
import { RigSpecSchema, LegacyRigSpecSchema } from "./rigspec-schema.js";
import { parseAgentSpec, validateAgentSpec } from "./agent-manifest.js";
// -- Review errors --
export class SpecReviewError extends Error {
    errors;
    constructor(errors) {
        super(`Spec validation failed: ${errors.join("; ")}`);
        this.errors = errors;
        this.name = "SpecReviewError";
    }
}
// -- Service --
function isPodAware(raw) {
    return Array.isArray(raw["pods"]);
}
function inferNodeKind(runtime) {
    return runtime === "terminal" ? "infrastructure" : "agent";
}
export class SpecReviewService {
    reviewRigSpec(yaml, sourceState) {
        let raw;
        try {
            raw = RigSpecCodec.parse(yaml);
        }
        catch (err) {
            throw new SpecReviewError([`YAML parse error: ${err.message}`]);
        }
        if (!raw || typeof raw !== "object") {
            throw new SpecReviewError(["Failed to parse YAML"]);
        }
        const obj = raw;
        if (isPodAware(obj)) {
            return this.reviewPodAwareRigSpec(obj, yaml, sourceState);
        }
        return this.reviewLegacyRigSpec(obj, yaml, sourceState);
    }
    reviewPodAwareRigSpec(obj, yaml, sourceState) {
        const validation = RigSpecSchema.validate(obj);
        if (!validation.valid) {
            throw new SpecReviewError(validation.errors);
        }
        const name = obj["name"];
        const version = obj["version"];
        const summary = obj["summary"];
        const cultureFile = obj["culture_file"];
        const rawPods = obj["pods"] ?? [];
        const rawCrossPodEdges = obj["edges"] ?? [];
        const pods = rawPods.map((pod) => {
            const members = (pod["members"] ?? []).map((m) => ({
                id: m["id"],
                agentRef: m["agent_ref"],
                runtime: m["runtime"],
                profile: m["profile"],
            }));
            const podEdges = (pod["edges"] ?? []).map((e) => ({
                from: e["from"],
                to: e["to"],
                kind: e["kind"],
            }));
            return {
                id: pod["id"],
                namespace: pod["namespace"],
                label: pod["label"],
                members,
                edges: podEdges,
            };
        });
        const crossPodEdges = rawCrossPodEdges.map((e) => ({
            from: e["from"],
            to: e["to"],
            kind: e["kind"],
        }));
        // Build graph
        const graphNodes = [];
        const graphEdges = [];
        for (const pod of pods) {
            for (const member of pod.members) {
                const qualifiedId = `${pod.id}.${member.id}`;
                graphNodes.push({
                    id: qualifiedId,
                    label: member.id,
                    pod: pod.id,
                    runtime: member.runtime,
                    kind: inferNodeKind(member.runtime),
                });
            }
            for (const edge of pod.edges) {
                graphEdges.push({
                    source: `${pod.id}.${edge.from}`,
                    target: `${pod.id}.${edge.to}`,
                    kind: edge.kind,
                });
            }
        }
        for (const edge of crossPodEdges) {
            graphEdges.push({ source: edge.from, target: edge.to, kind: edge.kind });
        }
        // Extract services metadata if present
        let services;
        const rawServices = obj["services"];
        if (rawServices && typeof rawServices === "object" && rawServices["kind"] === "compose") {
            const rawWaitFor = rawServices["wait_for"] ?? [];
            const rawSurfaces = rawServices["surfaces"];
            services = {
                kind: "compose",
                composeFile: rawServices["compose_file"],
                projectName: rawServices["project_name"],
                downPolicy: rawServices["down_policy"],
                waitFor: rawWaitFor.map((w) => ({
                    service: w["service"],
                    url: w["url"],
                    tcp: w["tcp"],
                    condition: w["condition"],
                })),
                ...(rawSurfaces ? {
                    surfaces: {
                        urls: rawSurfaces["urls"] ?? undefined,
                        commands: rawSurfaces["commands"] ?? undefined,
                    },
                } : {}),
            };
        }
        return {
            sourceState,
            kind: "rig",
            name,
            version,
            summary,
            cultureFile,
            ...(services ? { services } : {}),
            format: "pod_aware",
            pods,
            edges: crossPodEdges,
            graph: { nodes: graphNodes, edges: graphEdges },
            raw: yaml,
        };
    }
    reviewLegacyRigSpec(obj, yaml, sourceState) {
        const validation = LegacyRigSpecSchema.validate(obj);
        if (!validation.valid) {
            throw new SpecReviewError(validation.errors);
        }
        const name = obj["name"];
        const version = obj["version"];
        const rawNodes = obj["nodes"] ?? [];
        const rawEdges = obj["edges"] ?? [];
        const nodes = rawNodes.map((n) => ({
            id: n["id"],
            runtime: n["runtime"],
            role: n["role"],
            model: n["model"],
        }));
        const edges = rawEdges.map((e) => ({
            from: (e["source"] ?? e["from"]),
            to: (e["target"] ?? e["to"]),
            kind: e["kind"],
        }));
        const graphNodes = nodes.map((n) => ({
            id: n.id,
            label: n.id,
            runtime: n.runtime,
            kind: inferNodeKind(n.runtime),
        }));
        const graphEdges = edges.map((e) => ({
            source: e.from,
            target: e.to,
            kind: e.kind,
        }));
        return {
            sourceState,
            kind: "rig",
            name,
            version,
            format: "legacy",
            nodes,
            edges,
            graph: { nodes: graphNodes, edges: graphEdges },
            raw: yaml,
        };
    }
    reviewAgentSpec(yaml, sourceState) {
        let raw;
        try {
            raw = parseAgentSpec(yaml);
        }
        catch (err) {
            throw new SpecReviewError([`YAML parse error: ${err.message}`]);
        }
        const validation = validateAgentSpec(raw);
        if (!validation.valid) {
            throw new SpecReviewError(validation.errors);
        }
        const obj = raw;
        const name = obj["name"];
        const version = obj["version"];
        const description = obj["description"];
        // Profiles — AgentSpec stores profiles as a map, not an array
        const rawProfiles = (obj["profiles"] ?? {});
        const profiles = Object.entries(rawProfiles).map(([name, value]) => ({
            name,
            description: value?.["description"],
        }));
        // Resources
        const rawResources = (obj["resources"] ?? {});
        const extractPaths = (arr) => {
            if (!Array.isArray(arr))
                return [];
            return arr.map((item) => {
                if (typeof item === "string")
                    return item;
                if (typeof item === "object" && item !== null)
                    return item["path"] ?? "";
                return "";
            }).filter(Boolean);
        };
        // Plugin entries have a different shape: { id, source: { kind, path } }.
        // The id is the human-readable handle for the review surface (operator
        // recognizes "openrig-core" not "/Users/op/.openrig/plugins/openrig-core").
        const extractPluginIds = (raw) => {
            if (!Array.isArray(raw))
                return [];
            return raw.map((item) => {
                if (typeof item === "object" && item !== null) {
                    return item["id"] ?? "";
                }
                return "";
            }).filter(Boolean);
        };
        const resources = {
            skills: extractPaths(rawResources["skills"]),
            guidance: extractPaths(rawResources["guidance"]),
            plugins: extractPluginIds(rawResources["plugins"]),
            subagents: extractPaths(rawResources["subagents"]),
        };
        // Startup
        const rawStartup = (obj["startup"] ?? {});
        const startupFiles = (rawStartup["files"] ?? []).map((f) => ({
            path: f["path"],
            required: f["required"] ?? false,
        }));
        const startupActions = (rawStartup["actions"] ?? []).map((a) => ({
            type: a["type"],
            value: a["value"],
        }));
        return {
            sourceState,
            kind: "agent",
            name,
            version,
            description,
            profiles,
            resources,
            startup: { files: startupFiles, actions: startupActions },
            raw: yaml,
        };
    }
}
//# sourceMappingURL=spec-review-service.js.map