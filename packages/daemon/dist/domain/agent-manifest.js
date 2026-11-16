import { parse as parseYaml } from "yaml";
import { validateStartupBlock as sharedValidateStartupBlock, normalizeStartupBlock as sharedNormalizeStartupBlock, } from "./startup-validation.js";
import { parseSessionName, validateSessionName } from "./session-name.js";
// -- Constants --
const VALID_EXECUTION_MODES = new Set(["interactive_resident"]);
const VALID_COMPACTION_STRATEGIES = new Set(["default-compaction", "managed-compaction", "handover", "apprentice-handover"]);
/** OPR.0.5.6.20 A1 — the reserved-era spellings stay accepted through the deprecation
 *  window and normalize with an advisory, never silently. pod_continuity's disposition
 *  derives from the 0.5.2 source map: "the handover practice is pod_continuity's
 *  implementation, not a new concept". */
const DEPRECATED_COMPACTION_ALIASES = {
    harness_native: "default-compaction",
    pod_continuity: "handover",
};
/** Canonical form of a compaction strategy: new values pass through, deprecated aliases
 *  map, anything else is null. The ONE vocabulary site — resolvers import this rather
 *  than re-encoding the set (one-shared-resolution-path). */
export function canonicalCompactionStrategy(value) {
    if (VALID_COMPACTION_STRATEGIES.has(value))
        return value;
    return DEPRECATED_COMPACTION_ALIASES[value] ?? null;
}
/** One ingestion authority for the continuity mechanic address. */
export function canonicalContinuityMechanic(value) {
    if (typeof value !== "string" || !validateSessionName(value))
        return null;
    return parseSessionName(value).kind === "canonical" ? value : null;
}
const VALID_RESTORE_POLICIES = new Set(["resume_if_possible", "relaunch_fresh", "checkpoint_only"]);
const VALID_IMPORT_PREFIXES = ["local:", "path:"];
import { validateSafePath } from "./path-safety.js";
// -- Import validation --
function validateImportRef(ref, index) {
    if (!ref || typeof ref !== "string")
        return `imports[${index}].ref: must be a non-empty string`;
    const hasValidPrefix = VALID_IMPORT_PREFIXES.some((p) => ref.startsWith(p));
    if (!hasValidPrefix)
        return `imports[${index}].ref: must start with "local:" or "path:" (got "${ref}")`;
    if (ref.startsWith("local:")) {
        const path = ref.slice("local:".length);
        if (!path)
            return `imports[${index}].ref: local: ref must have a path`;
        if (path.startsWith("/"))
            return `imports[${index}].ref: local: ref must be a relative path (got "${ref}")`;
    }
    if (ref.startsWith("path:")) {
        const path = ref.slice("path:".length);
        if (!path)
            return `imports[${index}].ref: path: ref must have a path`;
        if (!path.startsWith("/"))
            return `imports[${index}].ref: path: ref must be an absolute path (got "${ref}")`;
    }
    return null;
}
function validateImportVersion(version, index) {
    if (version === undefined || version === null)
        return null;
    if (typeof version !== "string")
        return `imports[${index}].version: must be a string`;
    if (/[~^>=<|]/.test(version))
        return `imports[${index}].version: version ranges are not supported; use exact version (got "${version}")`;
    return null;
}
// Startup validation delegated to shared module
const validateStartupBlock = sharedValidateStartupBlock;
// -- Lifecycle validation --
function validateLifecycle(raw, prefix) {
    if (raw === undefined || raw === null)
        return { errors: [], advisories: [] };
    if (typeof raw !== "object")
        return { errors: [`${prefix}: must be an object`], advisories: [] };
    const obj = raw;
    const errors = [];
    const advisories = [];
    if (obj["execution_mode"] !== undefined) {
        if (obj["execution_mode"] === "wake_on_demand") {
            errors.push(`${prefix}.execution_mode: "wake_on_demand" is not supported in v1; use "interactive_resident"`);
        }
        else if (!VALID_EXECUTION_MODES.has(obj["execution_mode"])) {
            errors.push(`${prefix}.execution_mode: must be "interactive_resident" (got "${obj["execution_mode"]}")`);
        }
    }
    if (obj["compaction_strategy"] !== undefined) {
        const strategyValue = obj["compaction_strategy"];
        if (strategyValue === "custom_prompt") {
            // OPR.0.5.6.20 A1: this rejection is byte-preserved from the reserved era.
            errors.push(`${prefix}.compaction_strategy: "custom_prompt" is not supported in v1; use "harness_native" or "pod_continuity"`);
        }
        else if (DEPRECATED_COMPACTION_ALIASES[strategyValue] !== undefined) {
            advisories.push(`${prefix}.compaction_strategy: "${strategyValue}" is deprecated and now normalizes to "${DEPRECATED_COMPACTION_ALIASES[strategyValue]}" — update to the current vocabulary (${[...VALID_COMPACTION_STRATEGIES].join(", ")})`);
        }
        else if (!VALID_COMPACTION_STRATEGIES.has(strategyValue)) {
            errors.push(`${prefix}.compaction_strategy: must be one of ${[...VALID_COMPACTION_STRATEGIES].join(", ")} (got "${strategyValue}")`);
        }
    }
    if (obj["mechanic"] !== undefined &&
        canonicalContinuityMechanic(obj["mechanic"]) === null) {
        errors.push(`${prefix}.mechanic: must be a canonical seat@rig session address`);
    }
    if (obj["restore_policy"] !== undefined && !VALID_RESTORE_POLICIES.has(obj["restore_policy"])) {
        errors.push(`${prefix}.restore_policy: must be one of ${[...VALID_RESTORE_POLICIES].join(", ")} (got "${obj["restore_policy"]}")`);
    }
    return { errors, advisories };
}
// -- Resource validation --
function validateResourcePaths(resources, category) {
    const errors = [];
    const ids = new Set();
    for (let i = 0; i < resources.length; i++) {
        const r = resources[i];
        if (!r || typeof r !== "object" || Array.isArray(r)) {
            errors.push(`resources.${category}[${i}]: must be an object`);
            continue;
        }
        if (!r.id || typeof r.id !== "string") {
            errors.push(`resources.${category}[${i}].id: must be a non-empty string`);
        }
        else if (ids.has(r.id)) {
            errors.push(`resources.${category}: duplicate id "${r.id}"`);
        }
        else {
            ids.add(r.id);
        }
        const pathErr = validateSafePath(r.path, `resources.${category}[${i}].path`);
        if (pathErr)
            errors.push(pathErr);
    }
    return errors;
}
// -- Public API --
/**
 * Parse raw YAML text into an untyped object.
 * @param yamlText - raw YAML content of agent.yaml
 * @returns parsed object
 */
export function parseAgentSpec(yamlText) {
    return parseYaml(yamlText);
}
/**
 * Validate a parsed AgentSpec object. Collects all errors.
 * @param raw - parsed YAML object
 * @returns validation result with all errors
 */
export function validateAgentSpec(raw) {
    const errors = [];
    // OPR.0.5.6.20 — non-blocking deprecation advisories ride the shipped fail-open channel.
    const advisories = [];
    if (!raw || typeof raw !== "object") {
        return { valid: false, errors: ["agent spec must be an object"] };
    }
    const obj = raw;
    const hasImports = Array.isArray(obj["imports"]) && obj["imports"].length > 0;
    // Required fields
    if (!obj["name"] || typeof obj["name"] !== "string")
        errors.push("name: required non-empty string");
    if (!obj["version"] || typeof obj["version"] !== "string")
        errors.push("version: required non-empty string");
    // Imports
    if (obj["imports"] !== undefined) {
        if (!Array.isArray(obj["imports"])) {
            errors.push("imports: must be an array");
        }
        else {
            for (let i = 0; i < obj["imports"].length; i++) {
                const imp = obj["imports"][i];
                if (!imp || typeof imp !== "object" || Array.isArray(imp)) {
                    errors.push(`imports[${i}]: must be an object`);
                    continue;
                }
                const refErr = validateImportRef(imp["ref"], i);
                if (refErr)
                    errors.push(refErr);
                const verErr = validateImportVersion(imp["version"], i);
                if (verErr)
                    errors.push(verErr);
            }
        }
    }
    // Defaults lifecycle + effort advisory
    if (obj["defaults"] && typeof obj["defaults"] === "object") {
        const defaults = obj["defaults"];
        if (defaults["lifecycle"]) {
            {
                const lifecycleResult = validateLifecycle(defaults["lifecycle"], "defaults.lifecycle");
                errors.push(...lifecycleResult.errors);
                advisories.push(...lifecycleResult.advisories);
            }
        }
        if (defaults["effort"] !== undefined && (typeof defaults["effort"] !== "string" || !defaults["effort"].trim())) {
            advisories.push(`defaults.effort: non-string value "${defaults["effort"]}" ignored; effort must be a text value`);
        }
    }
    // Startup
    errors.push(...validateStartupBlock(obj["startup"], "startup"));
    // Profiles shape validation
    if (obj["profiles"] !== undefined && (typeof obj["profiles"] !== "object" || Array.isArray(obj["profiles"]) || obj["profiles"] === null)) {
        errors.push("profiles: must be a map (object), not an array or scalar");
    }
    // Profile startup + lifecycle + effort advisory
    if (obj["profiles"] && typeof obj["profiles"] === "object" && !Array.isArray(obj["profiles"])) {
        for (const [profileName, profileRaw] of Object.entries(obj["profiles"])) {
            if (profileRaw && typeof profileRaw === "object") {
                const p = profileRaw;
                errors.push(...validateStartupBlock(p["startup"], `profiles.${profileName}.startup`));
                if (p["lifecycle"]) {
                    {
                        const lifecycleResult = validateLifecycle(p["lifecycle"], `profiles.${profileName}.lifecycle`);
                        errors.push(...lifecycleResult.errors);
                        advisories.push(...lifecycleResult.advisories);
                    }
                }
                const prefs = p["preferences"];
                if (prefs && typeof prefs === "object") {
                    const prefsObj = prefs;
                    if (prefsObj["effort"] !== undefined && (typeof prefsObj["effort"] !== "string" || !prefsObj["effort"].trim())) {
                        advisories.push(`profiles.${profileName}.preferences.effort: non-string value "${prefsObj["effort"]}" ignored; effort must be a text value`);
                    }
                }
            }
        }
    }
    // Resources
    // allLocalIds is also used for profile.uses validation below; build it
    // unconditionally (empty maps when resources block absent) so profiles can
    // be validated even on specs with no resources block.
    const allLocalIds = {
        skills: new Set(),
        guidance: new Set(),
        subagents: new Set(),
        plugins: new Set(),
        runtime_resources: new Set(),
    };
    if (obj["resources"] && typeof obj["resources"] === "object") {
        const res = obj["resources"];
        // Reject legacy resources.hooks field with explicit migration error.
        // Per redo-guard-2 BLOCKING-CONCERN 2026-05-10: silent-drop in normalize
        // is not adequate backward-compat — operator must get clear error
        // pointing at the migration target so they update their spec.
        if (res["hooks"] !== undefined) {
            errors.push(`resources.hooks: removed in plugin-primitive (Phase 3a). Hooks now ship inside plugins; declare a plugin under resources.plugins[] instead. See plugin-primitive DESIGN.md §3.`);
        }
        for (const category of ["skills", "guidance", "subagents", "plugins", "runtime_resources"]) {
            const items = res[category];
            if (items !== undefined) {
                if (!Array.isArray(items)) {
                    errors.push(`resources.${category}: must be an array`);
                }
                else {
                    const entries = items;
                    // A blank list item (`- `) parses to null; the per-category validators below
                    // report it, so the id bookkeeping and runtime checks just skip it.
                    const mappingEntries = entries.filter((e) => e && typeof e === "object" && !Array.isArray(e));
                    if (category === "plugins") {
                        // Plugin entries have a different shape (id + source object) — validate inline
                        errors.push(...validatePluginResources(entries));
                        allLocalIds[category] = new Set(mappingEntries.map((e) => e["id"]).filter(Boolean));
                    }
                    else {
                        errors.push(...validateResourcePaths(entries, category));
                        allLocalIds[category] = new Set(mappingEntries.map((e) => e["id"]).filter(Boolean));
                    }
                    // runtime_resources must have runtime field
                    if (category === "runtime_resources") {
                        for (let i = 0; i < entries.length; i++) {
                            if (!entries[i] || typeof entries[i] !== "object" || Array.isArray(entries[i]))
                                continue;
                            if (!entries[i]["runtime"] || typeof entries[i]["runtime"] !== "string") {
                                errors.push(`resources.runtime_resources[${i}].runtime: required non-empty string`);
                            }
                            if (!entries[i]["type"] || typeof entries[i]["type"] !== "string") {
                                errors.push(`resources.runtime_resources[${i}].type: required non-empty string`);
                            }
                        }
                    }
                }
            }
        }
    }
    // Profile uses validation — runs even when no resources block declared so
    // legacy profile.uses.hooks rejection + missing-ref detection cover all
    // spec shapes.
    if (obj["profiles"] && typeof obj["profiles"] === "object" && !Array.isArray(obj["profiles"])) {
        for (const [profileName, profileRaw] of Object.entries(obj["profiles"])) {
            if (profileRaw && typeof profileRaw === "object") {
                const p = profileRaw;
                if (p["uses"] && typeof p["uses"] === "object") {
                    const uses = p["uses"];
                    // Reject legacy profile.uses.hooks field with explicit migration error.
                    // Per redo-guard-2 BLOCKING-CONCERN 2026-05-10.
                    if (uses["hooks"] !== undefined) {
                        errors.push(`profiles.${profileName}.uses.hooks: removed in plugin-primitive (Phase 3a). Reference plugins via profiles.${profileName}.uses.plugins[] instead.`);
                    }
                    for (const category of ["skills", "guidance", "subagents", "plugins", "runtime_resources"]) {
                        const refs = uses[category];
                        if (Array.isArray(refs)) {
                            for (const ref of refs) {
                                // Qualified refs (namespace:id) are accepted for later resolution
                                if (typeof ref === "string" && ref.includes(":")) {
                                    const parts = ref.split(":");
                                    if (parts.length < 2 || !parts[0] || !parts[1]) {
                                        errors.push(`profiles.${profileName}.uses.${category}: invalid qualified ref "${ref}" (must be namespace:id)`);
                                    }
                                    // Otherwise accepted — import resolution in AS-T03
                                }
                                else if (typeof ref === "string") {
                                    // Skills can come from runtime/spec-directory discovery or the
                                    // managed catalog. Resolve them with that context before launch;
                                    // the syntax validator cannot decide their absence here.
                                    if (category !== "skills" && !allLocalIds[category]?.has(ref) && !hasImports) {
                                        errors.push(`profiles.${profileName}.uses.${category}: resource "${ref}" not found in declared resources`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return { valid: errors.length === 0, errors, ...(advisories.length > 0 ? { advisories } : {}) };
}
/**
 * Normalize a validated AgentSpec into the canonical typed shape.
 * Applies defaults for optional fields.
 * @param raw - parsed YAML object (must pass validation first)
 * @returns normalized AgentSpec
 */
export function normalizeAgentSpec(raw) {
    const imports = Array.isArray(raw["imports"])
        ? raw["imports"].map((imp) => ({
            ref: imp["ref"],
            version: imp["version"],
        }))
        : [];
    const startup = normalizeStartupBlock(raw["startup"]);
    const resources = normalizeResources(raw["resources"]);
    const profiles = {};
    if (raw["profiles"] && typeof raw["profiles"] === "object" && !Array.isArray(raw["profiles"])) {
        for (const [name, profileRaw] of Object.entries(raw["profiles"])) {
            // A bare `default:` parses to null; treat it as an empty profile, same as `default: {}`.
            profiles[name] = normalizeProfile((profileRaw ?? {}));
        }
    }
    const defaults = raw["defaults"];
    const result = {
        version: raw["version"],
        name: raw["name"],
        summary: raw["summary"],
        imports,
        startup,
        resources,
        profiles,
    };
    if (defaults) {
        // OPR.0.5.6.20: lifecycle always materializes at the DEFAULTS level so the
        // defaults (default-compaction per F-6; resume_if_possible for restore) are
        // visible, not implied by absence. B-3/B-4: ONLY this level materializes —
        // profile blocks preserve absence so a non-specifying level never
        // participates in precedence.
        const lifecycle = normalizeLifecycle(defaults["lifecycle"] ?? {});
        result.defaults = {
            runtime: defaults["runtime"],
            model: defaults["model"],
            effort: typeof defaults["effort"] === "string" && defaults["effort"].trim()
                ? defaults["effort"].trim()
                : undefined,
            lifecycle: {
                ...lifecycle,
                compactionStrategy: lifecycle.compactionStrategy ?? "default-compaction",
                restorePolicy: lifecycle.restorePolicy ?? "resume_if_possible",
            },
        };
    }
    return result;
}
// -- Normalization helpers --
const normalizeStartupBlock = sharedNormalizeStartupBlock;
function normalizeLifecycle(raw) {
    // OPR.0.5.6.20 B-3/B-4: absence is preserved, never materialized — a lifecycle
    // block that omits a field must not acquire a value that later participates in
    // precedence. The defaults-level call site owns materializing the defaults.
    const rawStrategy = raw["compaction_strategy"];
    return {
        executionMode: raw["execution_mode"] ?? "interactive_resident",
        compactionStrategy: rawStrategy !== undefined
            ? (canonicalCompactionStrategy(rawStrategy) ?? "default-compaction")
            : undefined,
        mechanic: raw["mechanic"] !== undefined
            ? (canonicalContinuityMechanic(raw["mechanic"]) ?? undefined)
            : undefined,
        restorePolicy: raw["restore_policy"] !== undefined
            ? raw["restore_policy"]
            : undefined,
    };
}
function normalizeResources(raw) {
    if (!raw || typeof raw !== "object") {
        return { skills: [], guidance: [], subagents: [], plugins: [], runtimeResources: [] };
    }
    const obj = raw;
    return {
        skills: Array.isArray(obj["skills"])
            ? obj["skills"].map((s) => ({ id: s["id"], path: s["path"] }))
            : [],
        guidance: Array.isArray(obj["guidance"])
            ? obj["guidance"].map((g) => ({
                id: g["id"], path: g["path"],
                target: g["target"], merge: g["merge"] ?? "managed_block",
            }))
            : [],
        subagents: Array.isArray(obj["subagents"])
            ? obj["subagents"].map((s) => ({ id: s["id"], path: s["path"] }))
            : [],
        plugins: Array.isArray(obj["plugins"])
            ? obj["plugins"].map(normalizePluginResource)
            : [],
        runtimeResources: Array.isArray(obj["runtime_resources"])
            ? obj["runtime_resources"].map((r) => ({
                id: r["id"], path: r["path"],
                runtime: r["runtime"], type: r["type"],
            }))
            : [],
    };
}
function normalizePluginResource(raw) {
    const sourceRaw = (raw["source"] ?? {});
    const source = {
        kind: "local",
        path: sourceRaw["path"],
    };
    const result = {
        id: raw["id"],
        source,
    };
    const pluginType = raw["plugin_type"] ?? raw["pluginType"];
    if (pluginType === "claude" || pluginType === "codex" || pluginType === "auto") {
        result.pluginType = pluginType;
    }
    return result;
}
function validatePluginResources(entries) {
    const errors = [];
    const ids = new Set();
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            errors.push(`resources.plugins[${i}]: must be an object`);
            continue;
        }
        if (!entry["id"] || typeof entry["id"] !== "string") {
            errors.push(`resources.plugins[${i}].id: must be a non-empty string`);
        }
        else if (ids.has(entry["id"])) {
            errors.push(`resources.plugins: duplicate id "${entry["id"]}"`);
        }
        else {
            ids.add(entry["id"]);
        }
        const source = entry["source"];
        if (!source || typeof source !== "object" || Array.isArray(source)) {
            errors.push(`resources.plugins[${i}].source: must be an object with kind + source-specific fields`);
            continue;
        }
        const sourceObj = source;
        const kind = sourceObj["kind"];
        if (kind !== "local") {
            errors.push(`resources.plugins[${i}].source.kind: only "local" is supported in v0 (got "${String(kind)}")`);
            continue;
        }
        // Plugin paths may be absolute (e.g. ~/.openrig/plugins/<id> for vendored
        // plugins, or absolute project paths). Skip the safe-path check used for
        // in-spec resources; plugin sources are explicit operator-managed paths.
        const pluginPath = sourceObj["path"];
        if (!pluginPath || typeof pluginPath !== "string") {
            errors.push(`resources.plugins[${i}].source.path: must be a non-empty string`);
        }
        const pluginType = entry["plugin_type"] ?? entry["pluginType"];
        if (pluginType !== undefined && pluginType !== "claude" && pluginType !== "codex" && pluginType !== "auto") {
            errors.push(`resources.plugins[${i}].plugin_type: must be "claude" | "codex" | "auto" (got "${String(pluginType)}")`);
        }
    }
    return errors;
}
function normalizeProfile(raw) {
    const uses = raw["uses"];
    return {
        summary: raw["summary"],
        preferences: raw["preferences"]
            ? {
                runtime: raw["preferences"]["runtime"],
                model: raw["preferences"]["model"],
                effort: typeof raw["preferences"]["effort"] === "string" && raw["preferences"]["effort"].trim()
                    ? raw["preferences"]["effort"].trim()
                    : undefined,
            }
            : undefined,
        startup: raw["startup"] ? normalizeStartupBlock(raw["startup"]) : undefined,
        lifecycle: raw["lifecycle"] ? normalizeLifecycle(raw["lifecycle"]) : undefined,
        uses: {
            skills: Array.isArray(uses?.["skills"]) ? uses["skills"] : [],
            guidance: Array.isArray(uses?.["guidance"]) ? uses["guidance"] : [],
            subagents: Array.isArray(uses?.["subagents"]) ? uses["subagents"] : [],
            plugins: Array.isArray(uses?.["plugins"]) ? uses["plugins"] : [],
            runtimeResources: Array.isArray(uses?.["runtime_resources"]) ? uses["runtime_resources"] : [],
        },
        activity: normalizeActivityBlock(raw["activity"]),
    };
}
/**
 * Slice 15 — parse the `profile.activity` block. Returns undefined when
 * the block is absent or the inner `silence_window_seconds` is invalid
 * (non-integer / out of [1, 3600]); the daemon then uses its default
 * (3 seconds). Invalid values are dropped silently here; an explicit
 * validateAgentSpec error path can be added if operators report it as
 * confusing — for v0 dropping is the safer/simpler choice.
 *
 * Accepts both YAML snake_case (`silence_window_seconds`) and the
 * camelCase form the typed surface uses (`silenceWindowSeconds`).
 */
function normalizeActivityBlock(raw) {
    if (!raw || typeof raw !== "object")
        return undefined;
    const obj = raw;
    const candidate = obj["silence_window_seconds"] ?? obj["silenceWindowSeconds"];
    if (typeof candidate !== "number")
        return undefined;
    if (!Number.isFinite(candidate))
        return undefined;
    if (!Number.isInteger(candidate))
        return undefined;
    if (candidate < 1 || candidate > 3600)
        return undefined;
    return { silenceWindowSeconds: candidate };
}
//# sourceMappingURL=agent-manifest.js.map