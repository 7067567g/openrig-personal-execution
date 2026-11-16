import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
export function normalizePreconditionsBlock(raw, onMalformed) {
    const invalid = (reason) => { onMalformed?.(reason); return undefined; };
    if (raw === undefined)
        return undefined;
    if (!Array.isArray(raw))
        return invalid("preconditions must be an array");
    const result = [];
    for (const [index, entry] of raw.entries()) {
        const p = entry;
        if (!p || typeof p !== "object" || Array.isArray(p) || typeof p.name !== "string" || !p.name.trim()) {
            return invalid(`preconditions[${index}].name must be non-empty text`);
        }
        if (p.commands !== undefined && (!Array.isArray(p.commands) || p.commands.some(command => typeof command !== "string" || !command.trim() || /[\r\n]/.test(command)))) {
            return invalid(`preconditions[${index}].commands must be an array of non-empty, single-line strings`);
        }
        result.push({ name: p.name, ...(p.commands !== undefined ? { commands: [...p.commands] } : {}) });
    }
    return result;
}
/** Shared source-format spelling. Attribution only, not proof of authorship. */
export function normalizeBundleSource(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    const s = raw;
    if (typeof s.repository !== "string" || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(s.repository)
        || typeof s.folder !== "string" || /[\x00-\x1f\x7f]/.test(s.folder) || (s.folder !== "." && !isRelativeSafePath(s.folder))
        || typeof s.requestedRef !== "string" || !s.requestedRef || /[\x00-\x1f\x7f]/.test(s.requestedRef)
        || typeof s.resolvedCommit !== "string" || !/^[a-f0-9]{40}$/.test(s.resolvedCommit))
        return undefined;
    const expected = `${s.repository}/tree/${s.resolvedCommit}${s.folder === "." ? "" : "/" + s.folder.split("/").map(encodeURIComponent).join("/")}`;
    if (s.canonicalUrl !== expected)
        return undefined;
    return { repository: s.repository, folder: s.folder, requestedRef: s.requestedRef, resolvedCommit: s.resolvedCommit, canonicalUrl: expected };
}
const PROVENANCE_STRING_FIELDS = [
    "created_at",
    "source_host",
    "author_session",
    "source_rig_id",
    "source_rig_name",
    "daemon_version",
    "cli_version",
    "notes",
];
/** Validate optional provenance block. Appends to errors if present-but-malformed. */
function validateProvenanceBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push("provenance must be an object");
        return;
    }
    const p = raw;
    for (const field of PROVENANCE_STRING_FIELDS) {
        if (field in p && typeof p[field] !== "string") {
            errors.push(`provenance.${field} must be a string`);
        }
    }
    if (p.source !== undefined && !normalizeBundleSource(p.source))
        errors.push("provenance.source must name a credential-free GitHub folder at a full commit");
}
/** Serialize a typed BundleProvenance to the snake_case YAML record shape. */
function provenanceToYamlRecord(p) {
    const out = {};
    if (p.source)
        out.source = p.source;
    if (p.createdAt !== undefined)
        out["created_at"] = p.createdAt;
    if (p.sourceHost !== undefined)
        out["source_host"] = p.sourceHost;
    if (p.authorSession !== undefined)
        out["author_session"] = p.authorSession;
    if (p.sourceRigId !== undefined)
        out["source_rig_id"] = p.sourceRigId;
    if (p.sourceRigName !== undefined)
        out["source_rig_name"] = p.sourceRigName;
    if (p.daemonVersion !== undefined)
        out["daemon_version"] = p.daemonVersion;
    if (p.cliVersion !== undefined)
        out["cli_version"] = p.cliVersion;
    if (p.notes !== undefined)
        out["notes"] = p.notes;
    return out;
}
/** Validate optional plugins[] block. Appends to errors if present-but-malformed. */
function validatePluginsBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (!Array.isArray(raw)) {
        errors.push("plugins must be an array");
        return;
    }
    for (let i = 0; i < raw.length; i++) {
        const entry = raw[i];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            errors.push(`plugins[${i}] must be an object`);
            continue;
        }
        const p = entry;
        if (typeof p["id"] !== "string" || !p["id"]) {
            errors.push(`plugins[${i}].id is required`);
        }
        const source = p["source"];
        if (!source || typeof source !== "object" || Array.isArray(source)) {
            errors.push(`plugins[${i}].source must be an object`);
            continue;
        }
        const s = source;
        if (s["kind"] !== "local") {
            errors.push(`plugins[${i}].source.kind must be 'local' (other kinds reserved for future)`);
        }
        if (typeof s["path"] !== "string" || !s["path"]) {
            errors.push(`plugins[${i}].source.path is required`);
        }
        else if (!isRelativeSafePath(s["path"])) {
            errors.push(`plugins[${i}].source.path is not safe: '${s["path"]}'`);
        }
    }
}
/** Normalize raw plugins[] block (defensive copy). */
function normalizePluginsBlock(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const result = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            continue;
        const p = entry;
        const s = p["source"];
        if (typeof p["id"] !== "string" || !p["id"])
            continue;
        if (!s || typeof s !== "object" || Array.isArray(s))
            continue;
        const src = s;
        if (src["kind"] !== "local" || typeof src["path"] !== "string" || !src["path"])
            continue;
        result.push({ id: p["id"], source: { kind: "local", path: src["path"] } });
    }
    return result.length > 0 ? result : undefined;
}
/** Validate optional skills[] block. Appends to errors if present-but-malformed. */
function validateSkillsBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (!Array.isArray(raw)) {
        errors.push("skills must be an array");
        return;
    }
    for (let i = 0; i < raw.length; i++) {
        const entry = raw[i];
        if (typeof entry !== "string") {
            errors.push(`skills[${i}] must be a string`);
            continue;
        }
        if (!isRelativeSafePath(entry)) {
            errors.push(`skills[${i}] path is not safe: '${entry}'`);
        }
    }
}
/** Normalize raw skills[] block (defensive copy + string filter). */
function normalizeSkillsBlock(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const result = [];
    for (const entry of raw) {
        if (typeof entry === "string" && entry.length > 0)
            result.push(entry);
    }
    return result.length > 0 ? result : undefined;
}
/** Validate optional workflow_specs[] block. Appends to errors if present-but-malformed.
 * Item 6 / slice-05 Checkpoint 7.3e. Same shape as skills[]: array of relative-safe paths
 * to workflow spec YAML files inside the bundle. */
function validateWorkflowSpecsBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (!Array.isArray(raw)) {
        errors.push("workflow_specs must be an array");
        return;
    }
    for (let i = 0; i < raw.length; i++) {
        const entry = raw[i];
        if (typeof entry !== "string") {
            errors.push(`workflow_specs[${i}] must be a string`);
            continue;
        }
        if (!isRelativeSafePath(entry)) {
            errors.push(`workflow_specs[${i}] path is not safe: '${entry}'`);
        }
    }
}
/** Normalize raw workflow_specs[] block (defensive copy + string filter). */
function normalizeWorkflowSpecsBlock(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const result = [];
    for (const entry of raw) {
        if (typeof entry === "string" && entry.length > 0)
            result.push(entry);
    }
    return result.length > 0 ? result : undefined;
}
/** Validate optional context_packs[] block. Item 6 / slice-05 Checkpoint 7.3f.
 * Each entry is a relative-safe path to a context-pack's manifest.yaml inside
 * the bundle (per PRD §Item 6). The router copies the parent directory of
 * each manifest path to the operator context-packs library on install. */
function validateContextPacksBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (!Array.isArray(raw)) {
        errors.push("context_packs must be an array");
        return;
    }
    for (let i = 0; i < raw.length; i++) {
        const entry = raw[i];
        if (typeof entry !== "string") {
            errors.push(`context_packs[${i}] must be a string`);
            continue;
        }
        if (!isRelativeSafePath(entry)) {
            errors.push(`context_packs[${i}] path is not safe: '${entry}'`);
        }
    }
}
/** Normalize raw context_packs[] block (defensive copy + string filter). */
function normalizeContextPacksBlock(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const result = [];
    for (const entry of raw) {
        if (typeof entry === "string" && entry.length > 0)
            result.push(entry);
    }
    return result.length > 0 ? result : undefined;
}
/** Validate optional agent_images[] block. Item 6 / slice-05 Checkpoint 7.3g.
 * Each entry is a relative-safe path to an agent-image DIRECTORY inside the
 * bundle (per PRD §Item 6 line 197: agent_images: [path/to/agent-image-name/,
 * ...]). The router copies the declared directory itself to the operator
 * agent-images library on install. The consumer
 * (agent-image-library-service.ts:77-95) requires manifest.yaml to exist
 * inside each routed image dir; the router enforces that at copy time. */
function validateAgentImagesBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (!Array.isArray(raw)) {
        errors.push("agent_images must be an array");
        return;
    }
    for (let i = 0; i < raw.length; i++) {
        const entry = raw[i];
        if (typeof entry !== "string") {
            errors.push(`agent_images[${i}] must be a string`);
            continue;
        }
        if (!isRelativeSafePath(entry)) {
            errors.push(`agent_images[${i}] path is not safe: '${entry}'`);
        }
    }
}
/** Normalize raw agent_images[] block (defensive copy + string filter). */
function normalizeAgentImagesBlock(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const result = [];
    for (const entry of raw) {
        if (typeof entry === "string" && entry.length > 0)
            result.push(entry);
    }
    return result.length > 0 ? result : undefined;
}
/** Validate optional compatibility block. Appends to errors if present-but-malformed. */
function validateCompatibilityBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push("compatibility must be an object");
        return;
    }
    const c = raw;
    if ("min_daemon_version" in c && typeof c["min_daemon_version"] !== "string") {
        errors.push("compatibility.min_daemon_version must be a string");
    }
    if ("min_cli_version" in c && typeof c["min_cli_version"] !== "string") {
        errors.push("compatibility.min_cli_version must be a string");
    }
    if ("schema_version" in c && typeof c["schema_version"] !== "number") {
        errors.push("compatibility.schema_version must be a number");
    }
}
/** Serialize a typed BundleCompatibility to the snake_case YAML record shape. */
function compatibilityToYamlRecord(c) {
    const out = {};
    if (c.minDaemonVersion !== undefined)
        out["min_daemon_version"] = c.minDaemonVersion;
    if (c.minCliVersion !== undefined)
        out["min_cli_version"] = c.minCliVersion;
    if (c.schemaVersion !== undefined)
        out["schema_version"] = c.schemaVersion;
    return out;
}
/**
 * Normalize raw snake_case compatibility to typed camelCase BundleCompatibility.
 * Returns undefined when absent or empty. Exported alongside the provenance
 * normalizer so the v2 inspect-route projection can produce a single
 * camelCase shape for both manifest schemas.
 */
export function normalizeCompatibilityBlock(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    const c = raw;
    const result = {};
    if (typeof c["min_daemon_version"] === "string")
        result.minDaemonVersion = c["min_daemon_version"];
    if (typeof c["min_cli_version"] === "string")
        result.minCliVersion = c["min_cli_version"];
    if (typeof c["schema_version"] === "number")
        result.schemaVersion = c["schema_version"];
    return Object.keys(result).length > 0 ? result : undefined;
}
/**
 * Normalize raw snake_case provenance (as parsed from YAML or received from
 * a request body) to typed camelCase BundleProvenance. Returns undefined when
 * absent or empty. Exported so both the v1 normalizer pipeline and the v2
 * inspect-route projection produce identical camelCase shapes — the
 * /api/bundles/inspect contract is one shape regardless of schema version.
 */
export function normalizeProvenanceBlock(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    const p = raw;
    const result = {};
    const source = normalizeBundleSource(p.source);
    if (source)
        result.source = source;
    if (typeof p["created_at"] === "string")
        result.createdAt = p["created_at"];
    if (typeof p["source_host"] === "string")
        result.sourceHost = p["source_host"];
    if (typeof p["author_session"] === "string")
        result.authorSession = p["author_session"];
    if (typeof p["source_rig_id"] === "string")
        result.sourceRigId = p["source_rig_id"];
    if (typeof p["source_rig_name"] === "string")
        result.sourceRigName = p["source_rig_name"];
    if (typeof p["daemon_version"] === "string")
        result.daemonVersion = p["daemon_version"];
    if (typeof p["cli_version"] === "string")
        result.cliVersion = p["cli_version"];
    if (typeof p["notes"] === "string")
        result.notes = p["notes"];
    return Object.keys(result).length > 0 ? result : undefined;
}
/** A producer declaration, never a wildcard or a receiver approval. */
export function normalizeIncludedLoginFiles(raw) {
    if (raw === undefined)
        return undefined;
    if (!Array.isArray(raw) || raw.some(p => typeof p !== "string" || !isRelativeSafePath(p)) || new Set(raw).size !== raw.length) {
        throw new Error("included_login_files must be a list of unique, exact safe archive-relative login-file paths");
    }
    return raw;
}
function validateIncludedLoginFiles(raw, errors) {
    try {
        normalizeIncludedLoginFiles(raw);
    }
    catch (err) {
        errors.push(err.message);
    }
}
function validateProjectBlock(raw, errors) {
    if (raw === undefined)
        return;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push("project must be an object with id and path");
        return;
    }
    const p = raw;
    if (typeof p["id"] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p["id"]))
        errors.push("project.id must be a simple name (letters, digits, '.', '_', '-')");
    if (typeof p["path"] !== "string" || !isRelativeSafePath(p["path"]))
        errors.push("project.path must be a safe relative path");
}
export function validatePodBundleManifest(raw) {
    const errors = [];
    if (!raw || typeof raw !== "object")
        return { valid: false, errors: ["manifest must be an object"] };
    const m = raw;
    if (m["schema_version"] !== 2)
        errors.push("schema_version must be 2");
    if (typeof m["name"] !== "string" || !m["name"])
        errors.push("name is required");
    if (typeof m["version"] !== "string" || !m["version"])
        errors.push("version is required");
    if (typeof m["created_at"] !== "string" || !m["created_at"])
        errors.push("created_at is required");
    if (typeof m["rig_spec"] !== "string" || !m["rig_spec"])
        errors.push("rig_spec path is required");
    else if (!isRelativeSafePath(m["rig_spec"]))
        errors.push(`rig_spec path is not safe: '${m["rig_spec"]}'`);
    if (!Array.isArray(m["agents"])) {
        errors.push("agents must be an array");
    }
    else {
        for (let i = 0; i < m["agents"].length; i++) {
            const a = m["agents"][i];
            if (typeof a["name"] !== "string" || !a["name"])
                errors.push(`agents[${i}].name is required`);
            if (typeof a["path"] !== "string" || !a["path"])
                errors.push(`agents[${i}].path is required`);
            else if (!isRelativeSafePath(a["path"]))
                errors.push(`agents[${i}].path is not safe`);
            if (typeof a["hash"] !== "string" || !a["hash"])
                errors.push(`agents[${i}].hash is required`);
        }
    }
    validateProvenanceBlock(m["provenance"], errors);
    validateCompatibilityBlock(m["compatibility"], errors);
    validateSkillsBlock(m["skills"], errors);
    validatePluginsBlock(m["plugins"], errors);
    validateWorkflowSpecsBlock(m["workflow_specs"], errors);
    validateContextPacksBlock(m["context_packs"], errors);
    validateAgentImagesBlock(m["agent_images"], errors);
    validateProjectBlock(m["project"], errors);
    validateIncludedLoginFiles(m["included_login_files"], errors);
    return { valid: errors.length === 0, errors };
}
export function serializePodBundleManifest(manifest) {
    const doc = {
        schema_version: 2,
        name: manifest.name,
        version: manifest.version,
        created_at: manifest.createdAt,
        rig_spec: manifest.rigSpec,
        agents: manifest.agents.map((a) => ({
            name: a.name,
            version: a.version,
            path: a.path,
            original_ref: a.originalRef,
            hash: a.hash,
            import_entries: a.importEntries.map((ie) => ({
                name: ie.name,
                version: ie.version,
                path: ie.path,
                original_ref: ie.originalRef,
                hash: ie.hash,
            })),
        })),
    };
    if (manifest.cultureFile)
        doc["culture_file"] = manifest.cultureFile;
    if (manifest.integrity)
        doc["integrity"] = { algorithm: manifest.integrity.algorithm, files: manifest.integrity.files };
    if (manifest.includedLoginFiles?.length)
        doc["included_login_files"] = manifest.includedLoginFiles;
    if (manifest.assembler)
        doc["assembler"] = manifest.assembler;
    if (manifest.provenance)
        doc["provenance"] = provenanceToYamlRecord(manifest.provenance);
    if (manifest.compatibility)
        doc["compatibility"] = compatibilityToYamlRecord(manifest.compatibility);
    if (manifest.preconditions)
        doc["preconditions"] = manifest.preconditions;
    if (manifest.skills && manifest.skills.length > 0)
        doc["skills"] = manifest.skills;
    if (manifest.plugins && manifest.plugins.length > 0)
        doc["plugins"] = manifest.plugins.map((p) => ({ id: p.id, source: { kind: p.source.kind, path: p.source.path } }));
    if (manifest.workflowSpecs && manifest.workflowSpecs.length > 0)
        doc["workflow_specs"] = manifest.workflowSpecs;
    if (manifest.contextPacks && manifest.contextPacks.length > 0)
        doc["context_packs"] = manifest.contextPacks;
    if (manifest.agentImages && manifest.agentImages.length > 0)
        doc["agent_images"] = manifest.agentImages;
    if (manifest.project)
        doc["project"] = { id: manifest.project.id, path: manifest.project.path };
    if (manifest.configuration)
        doc["configuration"] = manifest.configuration.preset ? { id: manifest.configuration.id, preset: manifest.configuration.preset } : { id: manifest.configuration.id };
    return stringifyYaml(doc);
}
export function parsePodBundleManifest(yaml) {
    return parseYaml(yaml);
}
/**
 * Check if a path is a safe archive-relative path.
 * Rejects: absolute paths, ../ traversal, backslashes, dot segments (./, bare .),
 * empty segments (//), empty string.
 */
export function isRelativeSafePath(p) {
    if (!p || p.length === 0)
        return false;
    if (p.startsWith("/"))
        return false;
    if (p.includes("\\"))
        return false;
    const segments = p.split("/");
    for (const seg of segments) {
        if (seg === "" || seg === "." || seg === "..")
            return false;
    }
    return true;
}
/** Validate a raw parsed bundle manifest */
export function validateLegacyBundleManifest(raw, opts) {
    const errors = [];
    const requireIntegrity = opts?.requireIntegrity ?? true;
    if (!raw || typeof raw !== "object") {
        return { valid: false, errors: ["manifest must be an object"] };
    }
    const m = raw;
    if (m["schema_version"] !== 1)
        errors.push("schema_version must be 1");
    if (typeof m["name"] !== "string" || !m["name"])
        errors.push("name is required");
    if (typeof m["version"] !== "string" || !m["version"])
        errors.push("version is required");
    if (typeof m["created_at"] !== "string" || !m["created_at"])
        errors.push("created_at is required");
    // rig_spec path
    if (typeof m["rig_spec"] !== "string" || !m["rig_spec"]) {
        errors.push("rig_spec path is required");
    }
    else if (!isRelativeSafePath(m["rig_spec"])) {
        errors.push(`rig_spec path is not a safe relative path: '${m["rig_spec"]}'`);
    }
    // packages
    if (!Array.isArray(m["packages"]) || m["packages"].length === 0) {
        errors.push("packages must be a non-empty array");
    }
    else {
        for (let i = 0; i < m["packages"].length; i++) {
            const pkg = m["packages"][i];
            if (typeof pkg["name"] !== "string" || !pkg["name"])
                errors.push(`packages[${i}].name is required`);
            if (typeof pkg["version"] !== "string" || !pkg["version"])
                errors.push(`packages[${i}].version is required`);
            if (typeof pkg["path"] !== "string" || !pkg["path"]) {
                errors.push(`packages[${i}].path is required`);
            }
            else if (!isRelativeSafePath(pkg["path"])) {
                errors.push(`packages[${i}].path is not a safe relative path: '${pkg["path"]}'`);
            }
            if (typeof pkg["original_source"] !== "string" || !pkg["original_source"])
                errors.push(`packages[${i}].original_source is required`);
        }
    }
    // integrity (optional unless requireIntegrity)
    // Integrity validation — always validate structure when present, require when flag set
    const hasIntegrity = m["integrity"] && typeof m["integrity"] === "object";
    if (requireIntegrity && !hasIntegrity) {
        errors.push("integrity section is required");
    }
    if (hasIntegrity) {
        const integrity = m["integrity"];
        if (integrity["algorithm"] !== "sha256")
            errors.push("integrity.algorithm must be 'sha256'");
        if (!integrity["files"] || typeof integrity["files"] !== "object" || Object.keys(integrity["files"]).length === 0) {
            errors.push("integrity.files must be a non-empty object");
        }
        else {
            const files = integrity["files"];
            for (const [key, value] of Object.entries(files)) {
                if (!isRelativeSafePath(key)) {
                    errors.push(`integrity.files key is not a safe relative path: '${key}'`);
                }
                if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
                    errors.push(`integrity.files['${key}'] must be a 64-char hex SHA-256 hash`);
                }
            }
        }
    }
    validateProvenanceBlock(m["provenance"], errors);
    validateCompatibilityBlock(m["compatibility"], errors);
    validateSkillsBlock(m["skills"], errors);
    validatePluginsBlock(m["plugins"], errors);
    validateWorkflowSpecsBlock(m["workflow_specs"], errors);
    validateContextPacksBlock(m["context_packs"], errors);
    validateAgentImagesBlock(m["agent_images"], errors);
    // A bundle's project block is read on install by routeBundleContents, which joins project.id
    // onto workspace.projects_root and project.path onto the extracted bundle root. The pod-aware
    // (v2) validator already enforces containment here; the legacy (v1) validator must too, or a v1
    // bundle can escape the projects root (write) or the bundle root (read).
    validateProjectBlock(m["project"], errors);
    validateIncludedLoginFiles(m["included_login_files"], errors);
    return { valid: errors.length === 0, errors };
}
/** Parse bundle.yaml YAML string to unknown */
export function parseLegacyBundleManifest(yaml) {
    return parseYaml(yaml);
}
/** Normalize raw parsed manifest to typed LegacyBundleManifest */
export function normalizeLegacyBundleManifest(raw) {
    const m = raw;
    const pkgs = m["packages"].map((p) => {
        const entry = {
            name: p["name"],
            version: p["version"],
            path: p["path"],
            originalSource: p["original_source"] ?? "",
        };
        if (Array.isArray(p["original_sources"])) {
            entry.originalSources = p["original_sources"];
        }
        return entry;
    });
    const result = {
        schemaVersion: m["schema_version"] ?? 1,
        name: m["name"],
        version: m["version"],
        createdAt: m["created_at"] ?? new Date().toISOString(),
        rigSpec: m["rig_spec"],
        packages: pkgs,
    };
    if (m["integrity"] && typeof m["integrity"] === "object") {
        const integ = m["integrity"];
        result.integrity = {
            algorithm: "sha256",
            files: integ["files"] ?? {},
        };
    }
    const includedLoginFiles = normalizeIncludedLoginFiles(m["included_login_files"]);
    if (includedLoginFiles)
        result.includedLoginFiles = includedLoginFiles;
    const assembler = m["assembler"];
    if (assembler && typeof assembler.openrigVersion === "string")
        result.assembler = { openrigVersion: assembler.openrigVersion, ...(typeof assembler.commit === "string" ? { commit: assembler.commit } : {}) };
    const provenance = normalizeProvenanceBlock(m["provenance"]);
    if (provenance)
        result.provenance = provenance;
    const compatibility = normalizeCompatibilityBlock(m["compatibility"]);
    if (compatibility)
        result.compatibility = compatibility;
    const preconditions = normalizePreconditionsBlock(m["preconditions"]);
    if (preconditions)
        result.preconditions = preconditions;
    const skills = normalizeSkillsBlock(m["skills"]);
    if (skills)
        result.skills = skills;
    const plugins = normalizePluginsBlock(m["plugins"]);
    if (plugins)
        result.plugins = plugins;
    const workflowSpecs = normalizeWorkflowSpecsBlock(m["workflow_specs"]);
    if (workflowSpecs)
        result.workflowSpecs = workflowSpecs;
    const contextPacks = normalizeContextPacksBlock(m["context_packs"]);
    if (contextPacks)
        result.contextPacks = contextPacks;
    const agentImages = normalizeAgentImagesBlock(m["agent_images"]);
    if (agentImages)
        result.agentImages = agentImages;
    return result;
}
/** Serialize a LegacyBundleManifest to YAML */
export function serializeLegacyBundleManifest(manifest) {
    const doc = {
        schema_version: manifest.schemaVersion,
        name: manifest.name,
        version: manifest.version,
        created_at: manifest.createdAt,
        rig_spec: manifest.rigSpec,
        packages: manifest.packages.map((p) => ({
            name: p.name,
            version: p.version,
            path: p.path,
            original_source: p.originalSource,
            ...(p.originalSources && p.originalSources.length > 1 ? { original_sources: p.originalSources } : {}),
        })),
    };
    if (manifest.integrity) {
        doc["integrity"] = {
            algorithm: manifest.integrity.algorithm,
            files: manifest.integrity.files,
        };
    }
    if (manifest.includedLoginFiles?.length)
        doc["included_login_files"] = manifest.includedLoginFiles;
    if (manifest.assembler)
        doc["assembler"] = manifest.assembler;
    if (manifest.provenance)
        doc["provenance"] = provenanceToYamlRecord(manifest.provenance);
    if (manifest.compatibility)
        doc["compatibility"] = compatibilityToYamlRecord(manifest.compatibility);
    if (manifest.preconditions)
        doc["preconditions"] = manifest.preconditions;
    if (manifest.skills && manifest.skills.length > 0)
        doc["skills"] = manifest.skills;
    if (manifest.plugins && manifest.plugins.length > 0)
        doc["plugins"] = manifest.plugins.map((p) => ({ id: p.id, source: { kind: p.source.kind, path: p.source.path } }));
    if (manifest.workflowSpecs && manifest.workflowSpecs.length > 0)
        doc["workflow_specs"] = manifest.workflowSpecs;
    if (manifest.contextPacks && manifest.contextPacks.length > 0)
        doc["context_packs"] = manifest.contextPacks;
    if (manifest.agentImages && manifest.agentImages.length > 0)
        doc["agent_images"] = manifest.agentImages;
    return stringifyYaml(doc);
}
//# sourceMappingURL=bundle-types.js.map