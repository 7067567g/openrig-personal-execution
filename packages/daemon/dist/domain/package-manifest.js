import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
// --- Constants ---
const KNOWN_RUNTIMES = new Set(["claude-code", "codex"]);
const KNOWN_SCOPES = new Set(["project_shared", "project_local", "user_global", "system_managed", "session_ephemeral"]);
const KNOWN_GUIDANCE_KINDS = new Set(["agents_md", "claude_md", "generic_rules_overlay"]);
const KNOWN_MERGE_STRATEGIES = new Set(["managed_block", "append", "prepend", "replace", "manual"]);
const SEMVER_LIKE = /^\d+\.\d+\.\d+/;
// --- Parse ---
export function parseManifest(yamlString) {
    return parseYaml(yamlString);
}
// --- Validate ---
function hasPathTraversal(source) {
    return source.includes("../") || source === ".." || source.endsWith("/..");
}
const PACKAGE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
export function validateManifest(raw) {
    const errors = [];
    if (!raw || typeof raw !== "object") {
        return { valid: false, errors: ["Manifest must be an object"] };
    }
    const m = raw;
    // schema_version
    if (m["schema_version"] !== undefined && m["schema_version"] !== 1) {
        errors.push("schema_version must be 1");
    }
    // name
    if (!m["name"] || typeof m["name"] !== "string") {
        errors.push("name is required and must be a string");
    }
    else if (!PACKAGE_NAME_PATTERN.test(m["name"])) {
        errors.push("name must match [a-zA-Z0-9][a-zA-Z0-9._-]* (alphanumeric, dots, hyphens, underscores)");
    }
    // version
    if (!m["version"] || typeof m["version"] !== "string") {
        errors.push("version is required and must be a string");
    }
    else if (!SEMVER_LIKE.test(m["version"])) {
        errors.push("version must be semver-like (e.g., 1.0.0)");
    }
    // summary
    if (!m["summary"] || typeof m["summary"] !== "string") {
        errors.push("summary is required and must be a string");
    }
    // compatibility.runtimes
    const compat = m["compatibility"];
    if (!compat || !Array.isArray(compat["runtimes"]) || compat["runtimes"].length === 0) {
        errors.push("compatibility.runtimes is required and must be a non-empty array");
    }
    else {
        for (const rt of compat["runtimes"]) {
            if (!KNOWN_RUNTIMES.has(rt)) {
                errors.push(`Unknown runtime: '${rt}'`);
            }
        }
    }
    // exports
    const exports = m["exports"];
    if (!exports || typeof exports !== "object") {
        errors.push("exports is required and must be an object");
    }
    else {
        // Collect export names for role validation
        const skillNames = new Set();
        const guidanceNames = new Set();
        // skills
        if (Array.isArray(exports["skills"])) {
            for (const skill of exports["skills"]) {
                if (!skill["source"] || typeof skill["source"] !== "string") {
                    errors.push("Skill export: source is required");
                }
                else if (hasPathTraversal(skill["source"])) {
                    errors.push(`Skill export source must not contain path traversal: '${skill["source"]}'`);
                }
                if (!skill["name"] || typeof skill["name"] !== "string") {
                    errors.push("Skill export: name is required");
                }
                else {
                    const name = skill["name"];
                    if (skillNames.has(name)) {
                        errors.push(`Duplicate skill name: '${name}'`);
                    }
                    skillNames.add(name);
                }
                // Validate scopes
                if (Array.isArray(skill["supported_scopes"])) {
                    for (const scope of skill["supported_scopes"]) {
                        if (!KNOWN_SCOPES.has(scope)) {
                            errors.push(`Skill '${skill["name"] ?? "?"}': unknown scope '${scope}'`);
                        }
                    }
                }
                if (skill["default_scope"] && !KNOWN_SCOPES.has(skill["default_scope"])) {
                    errors.push(`Skill '${skill["name"] ?? "?"}': unknown default_scope '${skill["default_scope"]}'`);
                }
            }
        }
        // guidance
        if (Array.isArray(exports["guidance"])) {
            for (const g of exports["guidance"]) {
                if (!g["source"] || typeof g["source"] !== "string") {
                    errors.push("Guidance export: source is required");
                }
                else if (hasPathTraversal(g["source"])) {
                    errors.push(`Guidance export source must not contain path traversal: '${g["source"]}'`);
                }
                if (g["kind"] && !KNOWN_GUIDANCE_KINDS.has(g["kind"])) {
                    errors.push(`Unknown guidance kind: '${g["kind"]}'`);
                }
                if (!g["kind"]) {
                    errors.push("Guidance export: kind is required");
                }
                if (g["merge_strategy"] && !KNOWN_MERGE_STRATEGIES.has(g["merge_strategy"])) {
                    errors.push(`Unknown merge strategy: '${g["merge_strategy"]}'`);
                }
                if (!g["merge_strategy"]) {
                    errors.push("Guidance export: merge_strategy is required");
                }
                // Derive name for uniqueness check
                const name = g["name"] ??
                    (g["source"] ? g["source"].split("/").pop() : "");
                if (name && guidanceNames.has(name)) {
                    errors.push(`Duplicate guidance name: '${name}'`);
                }
                // Validate scopes
                if (Array.isArray(g["supported_scopes"])) {
                    for (const scope of g["supported_scopes"]) {
                        if (!KNOWN_SCOPES.has(scope)) {
                            errors.push(`Guidance '${name}': unknown scope '${scope}'`);
                        }
                    }
                }
                if (g["default_scope"] && !KNOWN_SCOPES.has(g["default_scope"])) {
                    errors.push(`Guidance '${name}': unknown default_scope '${g["default_scope"]}'`);
                }
                if (name)
                    guidanceNames.add(name);
            }
        }
        // agents
        const agentNames = new Set();
        if (Array.isArray(exports["agents"])) {
            for (const a of exports["agents"]) {
                if (!a["source"] || typeof a["source"] !== "string") {
                    errors.push("Agent export: source is required");
                }
                else if (hasPathTraversal(a["source"])) {
                    errors.push(`Agent export source must not contain path traversal: '${a["source"]}'`);
                }
                const agentName = a["name"] ??
                    (a["source"] ? a["source"].replace(/\.[^.]+$/, "").split("/").pop() : "");
                if (agentName && agentNames.has(agentName)) {
                    errors.push(`Duplicate agent name: '${agentName}'`);
                }
                if (agentName)
                    agentNames.add(agentName);
            }
        }
        // hooks
        if (Array.isArray(exports["hooks"])) {
            for (const h of exports["hooks"]) {
                if (!h["source"] || typeof h["source"] !== "string") {
                    errors.push("Hook export: source is required");
                }
                else if (hasPathTraversal(h["source"])) {
                    errors.push(`Hook export source must not contain path traversal: '${h["source"]}'`);
                }
            }
        }
        // mcp
        if (Array.isArray(exports["mcp"])) {
            for (const mc of exports["mcp"]) {
                if (!mc["source"] || typeof mc["source"] !== "string") {
                    errors.push("MCP export: source is required");
                }
                else if (hasPathTraversal(mc["source"])) {
                    errors.push(`MCP export source must not contain path traversal: '${mc["source"]}'`);
                }
            }
        }
        // roles
        if (Array.isArray(m["roles"])) {
            for (const role of m["roles"]) {
                if (Array.isArray(role["skills"])) {
                    for (const skillRef of role["skills"]) {
                        if (!skillNames.has(skillRef)) {
                            errors.push(`Role '${role["name"]}' references nonexistent skill: '${skillRef}'`);
                        }
                    }
                }
                if (Array.isArray(role["guidance"])) {
                    for (const guidanceRef of role["guidance"]) {
                        if (!guidanceNames.has(guidanceRef)) {
                            errors.push(`Role '${role["name"]}' references nonexistent guidance: '${guidanceRef}'`);
                        }
                    }
                }
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
// --- Normalize helpers ---
function normalizeRequirements(raw) {
    if (!raw || typeof raw !== "object")
        return undefined;
    const r = raw;
    return {
        cliTools: Array.isArray(r["cli_tools"])
            ? r["cli_tools"].map((t) => ({
                name: t["name"],
                requiredFor: t["required_for"],
                installHints: t["install_hints"],
            }))
            : undefined,
        systemPackages: Array.isArray(r["system_packages"])
            ? r["system_packages"].map((p) => ({
                name: p["name"],
            }))
            : undefined,
    };
}
function normalizeInstallPolicy(raw) {
    if (!raw || typeof raw !== "object")
        return undefined;
    const p = raw;
    return {
        requireReviewForExternalInstalls: p["require_review_for_external_installs"],
        allowUserGlobalWrites: p["allow_user_global_writes"],
        allowAgentMergeOfGuidance: p["allow_agent_merge_of_guidance"],
    };
}
function normalizeVerification(raw) {
    if (!raw || typeof raw !== "object")
        return undefined;
    const v = raw;
    if (!Array.isArray(v["checks"]))
        return undefined;
    return {
        checks: v["checks"].map((c) => ({
            type: c["type"],
            name: c["name"],
            command: c["command"],
        })),
    };
}
// --- Normalize ---
export function normalizeManifest(raw) {
    const m = raw;
    const exportsRaw = (m["exports"] ?? {});
    const skills = (Array.isArray(exportsRaw["skills"]) ? exportsRaw["skills"] : []).map((s) => ({
        source: s["source"],
        name: s["name"],
        supportedScopes: s["supported_scopes"] ?? ["project_shared"],
        defaultScope: s["default_scope"] ?? "project_shared",
    }));
    const guidance = (Array.isArray(exportsRaw["guidance"]) ? exportsRaw["guidance"] : []).map((g) => ({
        source: g["source"],
        name: g["name"] ?? g["source"].split("/").pop(),
        kind: g["kind"],
        supportedScopes: g["supported_scopes"] ?? ["project_shared"],
        defaultScope: g["default_scope"] ?? "project_shared",
        mergeStrategy: g["merge_strategy"],
    }));
    const agents = (Array.isArray(exportsRaw["agents"]) ? exportsRaw["agents"] : []).map((a) => ({
        source: a["source"],
        name: a["name"],
        supportedScopes: a["supported_scopes"],
        defaultScope: a["default_scope"],
    }));
    const hooks = (Array.isArray(exportsRaw["hooks"]) ? exportsRaw["hooks"] : []).map((h) => ({
        source: h["source"],
        supportedRuntimes: h["supported_runtimes"],
        supportedScopes: h["supported_scopes"],
        defaultScope: h["default_scope"],
    }));
    const mcp = (Array.isArray(exportsRaw["mcp"]) ? exportsRaw["mcp"] : []).map((mc) => ({
        source: mc["source"],
        supportedRuntimes: mc["supported_runtimes"],
        supportedScopes: mc["supported_scopes"],
        defaultScope: mc["default_scope"],
    }));
    const roles = Array.isArray(m["roles"])
        ? m["roles"].map((r) => ({
            name: r["name"],
            description: r["description"],
            skills: r["skills"],
            guidance: r["guidance"],
            hooks: r["hooks"],
            context: r["context"],
        }))
        : undefined;
    return {
        schemaVersion: m["schema_version"] ?? 1,
        name: m["name"],
        version: m["version"],
        summary: m["summary"],
        compatibility: { runtimes: m["compatibility"]?.["runtimes"] ?? [] },
        exports: { skills, guidance, agents, hooks, mcp },
        requirements: normalizeRequirements(m["requirements"]),
        installPolicy: normalizeInstallPolicy(m["install_policy"]),
        verification: normalizeVerification(m["verification"]),
        roles,
    };
}
// --- Serialize ---
export function serializeManifest(manifest) {
    const doc = {
        schema_version: manifest.schemaVersion,
        name: manifest.name,
        version: manifest.version,
        summary: manifest.summary,
        compatibility: { runtimes: manifest.compatibility.runtimes },
        exports: {},
    };
    const exports = doc["exports"];
    if (manifest.exports.skills?.length) {
        exports["skills"] = manifest.exports.skills.map((s) => ({
            source: s.source,
            name: s.name,
            supported_scopes: s.supportedScopes,
            default_scope: s.defaultScope,
        }));
    }
    if (manifest.exports.guidance?.length) {
        exports["guidance"] = manifest.exports.guidance.map((g) => ({
            source: g.source,
            name: g.name,
            kind: g.kind,
            supported_scopes: g.supportedScopes,
            default_scope: g.defaultScope,
            merge_strategy: g.mergeStrategy,
        }));
    }
    if (manifest.exports.agents?.length) {
        exports["agents"] = manifest.exports.agents.map((a) => ({
            source: a.source,
            ...(a.name ? { name: a.name } : {}),
            ...(a.supportedScopes ? { supported_scopes: a.supportedScopes } : {}),
            ...(a.defaultScope ? { default_scope: a.defaultScope } : {}),
        }));
    }
    if (manifest.exports.hooks?.length) {
        exports["hooks"] = manifest.exports.hooks.map((h) => ({
            source: h.source,
            ...(h.supportedRuntimes ? { supported_runtimes: h.supportedRuntimes } : {}),
            ...(h.supportedScopes ? { supported_scopes: h.supportedScopes } : {}),
            ...(h.defaultScope ? { default_scope: h.defaultScope } : {}),
        }));
    }
    if (manifest.exports.mcp?.length) {
        exports["mcp"] = manifest.exports.mcp.map((mc) => ({
            source: mc.source,
            ...(mc.supportedRuntimes ? { supported_runtimes: mc.supportedRuntimes } : {}),
            ...(mc.supportedScopes ? { supported_scopes: mc.supportedScopes } : {}),
            ...(mc.defaultScope ? { default_scope: mc.defaultScope } : {}),
        }));
    }
    if (manifest.requirements) {
        const req = {};
        if (manifest.requirements.cliTools?.length) {
            req["cli_tools"] = manifest.requirements.cliTools.map((t) => ({
                name: t.name,
                ...(t.requiredFor ? { required_for: t.requiredFor } : {}),
                ...(t.installHints ? { install_hints: t.installHints } : {}),
            }));
        }
        if (manifest.requirements.systemPackages?.length) {
            req["system_packages"] = manifest.requirements.systemPackages.map((p) => ({ name: p.name }));
        }
        doc["requirements"] = req;
    }
    if (manifest.installPolicy) {
        const pol = {};
        if (manifest.installPolicy.requireReviewForExternalInstalls !== undefined) {
            pol["require_review_for_external_installs"] = manifest.installPolicy.requireReviewForExternalInstalls;
        }
        if (manifest.installPolicy.allowUserGlobalWrites !== undefined) {
            pol["allow_user_global_writes"] = manifest.installPolicy.allowUserGlobalWrites;
        }
        if (manifest.installPolicy.allowAgentMergeOfGuidance !== undefined) {
            pol["allow_agent_merge_of_guidance"] = manifest.installPolicy.allowAgentMergeOfGuidance;
        }
        doc["install_policy"] = pol;
    }
    if (manifest.verification?.checks.length) {
        doc["verification"] = {
            checks: manifest.verification.checks.map((c) => ({
                type: c.type,
                ...(c.name ? { name: c.name } : {}),
                ...(c.command ? { command: c.command } : {}),
            })),
        };
    }
    if (manifest.roles?.length) {
        doc["roles"] = manifest.roles.map((r) => ({
            name: r.name,
            ...(r.description ? { description: r.description } : {}),
            ...(r.skills ? { skills: r.skills } : {}),
            ...(r.guidance ? { guidance: r.guidance } : {}),
            ...(r.hooks ? { hooks: r.hooks } : {}),
            ...(r.context ? { context: r.context } : {}),
        }));
    }
    return stringifyYaml(doc);
}
//# sourceMappingURL=package-manifest.js.map