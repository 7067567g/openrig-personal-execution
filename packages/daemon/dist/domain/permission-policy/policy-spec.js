// Slice-03 (OPR.0.4.8.3) Seam A — the permission-policy SPEC primitive: parse + validate-by-convention.
// A policy spec is a Markdown file with a leading YAML FRONTMATTER contract + an explanatory body.
// This module PARSES the whole contract from frontmatter (preserving the body verbatim) and
// VALIDATES it by convention — ADVISORY + fail-open (mirrors `rig scope audit`), never enforcement.
// It NEVER validates the semantic-action vocabulary (the taxonomy 668bb0d2 owns that) and NEVER
// resolves intent to a harness format (flag surface = deterministic code elsewhere; config surface =
// the skill). Schema authority: ARCH-POLICY-SPEC-SCHEMA sha256-8 92409094.
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { findFrontmatterBlock } from "../frontmatter.js";
/** Parse a policy spec into its frontmatter contract + preserved body. Never throws. */
export function parsePolicySpec(raw) {
    const block = findFrontmatterBlock(raw, { consumeClosingNewline: true });
    if (!block)
        return { error: "policy spec must open with a '---' YAML frontmatter block" };
    let frontmatter;
    try {
        frontmatter = parseYaml(block.yaml);
    }
    catch (e) {
        return { error: `frontmatter is not valid YAML: ${e.message}` };
    }
    if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
        return { error: "frontmatter must be a YAML object at the root" };
    }
    return { frontmatter: frontmatter, body: raw.slice(block.bodyStart) };
}
const SOURCES = new Set(["builtin", "custom"]);
const SURFACES = new Set(["flag", "config"]);
const LAUNCH_POSTURES = new Set(["floor", "full_bypass", "auto"]);
const DEFAULT_POSTURES = new Set(["allow", "ask", "deny"]);
const ACTION_LIST_FIELDS = ["allow", "ask", "deny", "destructive_class"];
function isStringList(v) {
    return Array.isArray(v) && v.every((x) => typeof x === "string");
}
/**
 * Validate-by-convention: required scalars, enum membership, surface-appropriate EXCLUSIVITY, and
 * scalar/list SHAPES. ADVISORY + fail-open — returns {ok, errors[]}, never throws, never enforces.
 * Does NOT validate the semantic-action vocabulary (taxonomy 668bb0d2 owns it) nor resolve to any
 * harness format.
 */
export function validatePolicySpec(fm) {
    const errors = [];
    if (fm["policy_schema_version"] !== 1)
        errors.push("policy_schema_version must be the number 1");
    if (typeof fm["name"] !== "string" || fm["name"].length === 0)
        errors.push("name must be a non-empty string");
    if (typeof fm["source"] !== "string" || !SOURCES.has(fm["source"]))
        errors.push("source must be 'builtin' or 'custom'");
    if (typeof fm["description"] !== "string" || fm["description"].length === 0)
        errors.push("description must be a non-empty string");
    const surface = fm["surface"];
    if (typeof surface !== "string" || !SURFACES.has(surface)) {
        errors.push("surface must be 'flag' or 'config'");
        return { ok: errors.length === 0, errors }; // can't check surface-appropriate fields without a valid surface
    }
    if (surface === "flag") {
        if (!LAUNCH_POSTURES.has(fm["launch_posture"]))
            errors.push("flag-surface policy requires launch_posture ('floor', 'full_bypass' or 'auto')");
        if (fm["default_posture"] !== undefined)
            errors.push("flag-surface policy must NOT carry default_posture (config-surface field)");
        for (const f of ACTION_LIST_FIELDS)
            if (fm[f] !== undefined)
                errors.push(`flag-surface policy must NOT carry '${f}' (config-surface field)`);
    }
    else {
        // config
        if (fm["launch_posture"] !== undefined)
            errors.push("config-surface policy must NOT carry launch_posture (flag-surface field)");
        if (!DEFAULT_POSTURES.has(fm["default_posture"]))
            errors.push("config-surface policy requires default_posture ('allow', 'ask' or 'deny')");
        // The schema requires all four action-list fields present (use [] for none) — not optional.
        for (const f of ACTION_LIST_FIELDS) {
            if (fm[f] === undefined)
                errors.push(`config-surface policy requires '${f}' (a list of strings; use [] for none)`);
            else if (!isStringList(fm[f]))
                errors.push(`${f} must be a list of strings`);
        }
    }
    return { ok: errors.length === 0, errors };
}
// Canonical field order for deterministic serialization (unknown keys appended stably after).
const CANONICAL_ORDER = [
    "source", "name", "surface", "launch_posture", "policy_schema_version", "description",
    "default_posture", "allow", "ask", "deny", "destructive_class",
];
/**
 * Deterministic CANONICAL serialization: frontmatter re-emitted in canonical field order (unknown
 * keys preserved, appended stably) + the body verbatim. Round-trip contract = serialize is STABLE
 * (serialize∘parse is idempotent) + SEMANTIC equality (frontmatter deep-equal) + BODY preserved —
 * NOT original-input byte identity.
 */
export function serializePolicySpec(parsed) {
    const fm = parsed.frontmatter;
    const ordered = {};
    for (const k of CANONICAL_ORDER)
        if (fm[k] !== undefined)
            ordered[k] = fm[k];
    for (const k of Object.keys(fm))
        if (!(k in ordered))
            ordered[k] = fm[k];
    const yamlBlock = stringifyYaml(ordered).replace(/\n+$/, "");
    return `---\n${yamlBlock}\n---\n${parsed.body}`;
}
//# sourceMappingURL=policy-spec.js.map