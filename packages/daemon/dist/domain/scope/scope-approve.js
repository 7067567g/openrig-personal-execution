// OPR.0.4.4.19 FR-9 — scope approve: frontmatter sole-writer + append-only
// audit row (kills vibe-shuttled approval).
//
// Daemon-side by design (plan-review CONFIRMED; arch-lead interface-cell
// PASS): the stamp is a workspace frontmatter write, the audit row is a
// mission_control_actions insert, and the freeze-trigger interface cell
// (Packet 2) invokes the compose-and-freeze endpoint AFTER the stamp+audit
// commit — so the stamp+audit pair lives behind ONE daemon operation.
//
// Ordering (arch-lead PIN, 2026-07-04): frontmatter-first → audit-second →
// on audit failure LOUD-FAIL + byte-restore the prior frontmatter. The
// compensating-DELETE variant is REJECTED — no row is ever deleted from
// mission_control_actions; append-only stands.
//
// Two-regime role clarity (BR-6, ratified): approval is the freeze/LOCKED
// trigger and the regime-2 sign-off — it is NEVER the source of proven-green.
// Nothing here computes or stores "green".
import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";
import { derivePlanLockArtifacts, isContentlessPlanLockSet } from "./plan-lock-artifacts.js";
import { sliceRelativeMediaPath } from "../review/compose.js";
import { NODE_FILE_PRECEDENCE, resolveNodeFile } from "./node-file.js";
export class ScopeApproveError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "ScopeApproveError";
    }
}
const STAMP_FIELDS = {
    delivery: { by: "approved-by", at: "approved-at", priors: "approved-priors" },
    spec: { by: "approved-spec-by", at: "approved-spec-at", priors: "approved-spec-priors" },
};
/**
 * A directory path with symlinks resolved when it exists, else resolved
 * lexically. Two spellings of the same directory — a worktree reached through
 * a link and the directory itself — canonicalize to one string.
 */
function canonicalDirectory(dir) {
    try {
        return fs.realpathSync(dir);
    }
    catch {
        return path.resolve(dir);
    }
}
export class ScopeApproveService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * The missions root this approval writes under: the caller's named root when
     * the request carried one, else the daemon's own (#995).
     *
     * A named root is accepted only as an absolute path to an existing
     * directory, and is canonicalized, so a worktree reached through a symlink
     * names the same root as its target. Every later check — path containment,
     * the node file and its frontmatter id, the no-half-stamp ordering — then
     * applies to that tree unchanged.
     */
    resolveMissionsRoot(named) {
        if (named === null || named === undefined || named === "") {
            const own = this.deps.missionsRoot();
            if (!own) {
                throw new ScopeApproveError("workspace_not_configured", "The daemon has no missions root configured; scope approve needs the workspace primitive.");
            }
            return canonicalDirectory(own);
        }
        if (!path.isAbsolute(named)) {
            throw new ScopeApproveError("missions_root_invalid", `missionsRoot '${named}' is not an absolute path; the caller resolves the workspace before sending it.`, { missionsRoot: named });
        }
        let isDirectory = false;
        try {
            isDirectory = fs.statSync(named).isDirectory();
        }
        catch {
            throw new ScopeApproveError("missions_root_invalid", `missionsRoot '${named}' does not exist; nothing was written.`, { missionsRoot: named });
        }
        if (!isDirectory) {
            throw new ScopeApproveError("missions_root_invalid", `missionsRoot '${named}' is not a directory; nothing was written.`, { missionsRoot: named });
        }
        return canonicalDirectory(named);
    }
    approve(input) {
        const missionsRoot = this.resolveMissionsRoot(input.missionsRoot);
        // Path containment: the scope path must resolve INSIDE the missions root
        // (content-surfaces discipline — no ../ escapes).
        const resolved = path.resolve(missionsRoot, input.scopePath);
        if (resolved !== missionsRoot && !resolved.startsWith(missionsRoot + path.sep)) {
            throw new ScopeApproveError("scope_path_escape", `scopePath '${input.scopePath}' resolves outside the missions root.`, { scopePath: input.scopePath });
        }
        const readmePath = resolveNodeFile(resolved);
        if (!readmePath) {
            throw new ScopeApproveError("scope_not_found", `No ${NODE_FILE_PRECEDENCE.join(" or ")} at ${input.scopePath} under the missions root — not a declared ${input.scopeTier}.`, { scopePath: input.scopePath, scopeTier: input.scopeTier });
        }
        const originalBytes = fs.readFileSync(readmePath, "utf8");
        const frontmatter = parseFrontmatter(originalBytes);
        const scopeId = typeof frontmatter["id"] === "string" && frontmatter["id"].trim().length > 0
            ? frontmatter["id"]
            : null;
        if (!scopeId) {
            throw new ScopeApproveError("scope_id_missing", `${input.scopePath} has no frontmatter id (dot-ID) — the audit target contract requires a stable scope_id.`, { scopePath: input.scopePath, action: "Run: rig scope " + input.scopeTier + " reconcile <path> to mint the id, then re-approve." });
        }
        // OPR.0.5.0.18 — the amend/re-stamp verb (ARCH-SHAPING 9d64ceb6 v2): a
        // lock is a point-in-time ATTESTATION, not an irreversible seal. Without
        // --re-approve, an existing stamp still refuses loudly — but the refusal
        // TEACHES the sanctioned verb instead of dead-ending. With it, the stamp
        // is superseded by a new reasoned attestation; both live in the
        // append-only audit log. A spec stamp followed by a delivery stamp is
        // still the normal staged sequence (different scopes never collide).
        const fields = STAMP_FIELDS[input.approvalScope];
        const existingBy = frontmatter[fields.by];
        const hasExistingStamp = typeof existingBy === "string" && existingBy.trim().length > 0;
        const isReApprove = input.reApprove === true;
        if (hasExistingStamp && !isReApprove) {
            throw new ScopeApproveError("already_approved", `${input.scopePath} already carries a ${input.approvalScope} approval stamp: ${fields.by}: ${existingBy}, ${fields.at}: ${String(frontmatter[fields.at] ?? "?")}. To amend/re-stamp it as a new reasoned attestation (prior preserved in the audit log), re-run with --re-approve --reason "<why>".`, { scopePath: input.scopePath, approvalScope: input.approvalScope, existingBy, existingAt: frontmatter[fields.at] ?? null });
        }
        const reason = typeof input.reason === "string" ? input.reason.trim() : "";
        if (isReApprove && reason.length === 0) {
            throw new ScopeApproveError("reason_required", `--re-approve is a reasoned deliberate act: pass --reason "<why>" describing what changed since the prior ${input.approvalScope} attestation.`, { scopePath: input.scopePath, approvalScope: input.approvalScope });
        }
        if (isReApprove && !hasExistingStamp) {
            throw new ScopeApproveError("nothing_to_reapprove", `${input.scopePath} carries no ${input.approvalScope} approval stamp to supersede — run a plain approve (without --re-approve) for the first attestation.`, { scopePath: input.scopePath, approvalScope: input.approvalScope });
        }
        const priorApprovedBy = hasExistingStamp ? existingBy : null;
        const priorApprovedAt = hasExistingStamp
            ? (typeof frontmatter[fields.at] === "string" ? frontmatter[fields.at] : null)
            : null;
        const priorCount = typeof frontmatter[fields.priors] === "number" ? frontmatter[fields.priors] : 0;
        const approvedAt = (this.deps.now?.() ?? new Date()).toISOString();
        // Stage-3 Lever A — plan-lock snapshot: ONLY a slice SPEC approval derives +
        // co-serializes the `locked-artifacts` set (mission/delivery NEVER create it;
        // a delivery merge preserves an existing list). PRD read fails open to null.
        //
        // B14 — the set must be CHOSEN, not inherited. An explicit `lockedArtifacts`
        // replaces derivation entirely (validated to exist, slice-relative). Without
        // it the derived default still applies, but a set that would freeze only a
        // missing/scaffold PRD refuses loudly: a plan-lock says "THIS artifact set
        // is what gets built", and two live locks froze placeholder bytes before
        // this check existed.
        const isPlanLock = input.scopeTier === "slice" && input.approvalScope === "spec";
        let lockedArtifacts;
        if (isPlanLock) {
            const explicit = Array.isArray(input.lockedArtifacts)
                ? input.lockedArtifacts.map((p) => String(p).trim()).filter((p) => p.length > 0)
                : [];
            if (explicit.length > 0) {
                lockedArtifacts = resolveExplicitPlanLockArtifacts(explicit, resolved, input.scopePath);
            }
            else {
                const prd = tryReadPRD(resolved);
                const nodeFileName = path.basename(readmePath) === "SPEC.md" ? "SPEC.md" : "README.md";
                lockedArtifacts = derivePlanLockArtifacts(originalBytes, prd, nodeFileName);
                if (isContentlessPlanLockSet(originalBytes, lockedArtifacts)) {
                    throw new ScopeApproveError("plan_lock_contentless", `${input.scopePath}: the derived locked-artifacts set contains only a contentless ${nodeFileName} — the lock would freeze content nobody chose.`, {
                        scopePath: input.scopePath,
                        action: "Author SPEC.md so the plan carries real content, or name the real set explicitly: rig scope slice approve <slice> --scope spec --locked-artifacts \"SPEC.md,PLAN-….md\".",
                    });
                }
            }
        }
        // 1. Frontmatter FIRST (the arch-pinned ordering). The stamp AND the
        // co-serialized `locked-artifacts` land in ONE writeFrontmatterFields +
        // writeFileSync — so a later audit failure restores a clean verbatim README.
        const updated = writeFrontmatterFields(originalBytes, {
            [fields.by]: input.actorSession,
            [fields.at]: approvedAt,
            // OPR.0.5.0.18 — amendment lineage in the ONE atomic frontmatter write:
            // prior-count rides beside the current attestation so the (filesystem-
            // local) scope audit can show lineage; the rows hold the full history.
            ...(isReApprove ? { [fields.priors]: priorCount + 1 } : {}),
            ...(isPlanLock ? { "locked-artifacts": lockedArtifacts } : {}),
            // P21 era-stamp: a `provenance:` line beside the approved-by stamp records how the approver
            // identity was established. Present (`transport:v1`) ⇒ transport-derived; absent ⇒ claimed-era.
            ...(input.identityProvenance ? { provenance: input.identityProvenance } : {}),
        });
        fs.writeFileSync(readmePath, updated, "utf8");
        // 2. Audit SECOND. On failure: byte-restore the prior frontmatter and
        // fail loudly — a failed audit write can never leave a trusted half-stamp
        // (QA plan-review guardrail), and no audit row is ever deleted.
        const scopePathCanonical = path.relative(missionsRoot, resolved).split(path.sep).join("/");
        const auditNotes = {
            kind: "scope-approval",
            scope_tier: input.scopeTier,
            scope_id: scopeId,
            scope_path: scopePathCanonical,
            missions_root: missionsRoot,
            approval_scope: input.approvalScope,
            on_behalf_of: input.onBehalfOf ?? null,
            // OPR.0.5.0.18 — the amendment row makes the supersession explicit
            // (additive keys; the audit-browse scope filters are untouched). The
            // provenance triple: authorizer = on_behalf_of, acting agent =
            // actor_session, reason = the verbatim operator reason.
            ...(isReApprove
                ? {
                    re_approval: true,
                    reason,
                    prior_approved_by: priorApprovedBy,
                    prior_approved_at: priorApprovedAt,
                    prior_count: priorCount + 1,
                }
                : {}),
        };
        let actionId;
        try {
            const baseReason = input.onBehalfOf
                ? `scope-approval (${input.approvalScope}) on behalf of ${input.onBehalfOf}`
                : `scope-approval (${input.approvalScope})`;
            const entry = this.deps.actionLog.record({
                actionVerb: "approve",
                qitemId: null, // scope approvals are NOT qitem actions
                actorSession: input.actorSession,
                actedAt: approvedAt,
                reason: isReApprove ? `${baseReason} re-approve: ${reason}` : baseReason,
                auditNotes,
                identityProvenance: input.identityProvenance ?? null,
            });
            actionId = entry.actionId;
        }
        catch (err) {
            fs.writeFileSync(readmePath, originalBytes, "utf8");
            throw new ScopeApproveError("audit_write_failed", `The approval audit row could not be written; the frontmatter stamp was restored to its prior state (no half-stamp). Cause: ${err instanceof Error ? err.message : String(err)}`, { scopePath: input.scopePath, approvalScope: input.approvalScope });
        }
        // 3. Freeze-trigger interface cell (Packet 2): the DELIVERY stamp will
        // synchronously invoke the ONE compose-and-freeze endpoint AFTER this
        // point. The endpoint does not exist at P1; when it lands, a failed
        // render never un-approves and never half-stamps — the stamp + audit
        // row above stand regardless of the render outcome.
        return {
            scopeTier: input.scopeTier,
            scopeId,
            scopePath: scopePathCanonical,
            approvalScope: input.approvalScope,
            approvedBy: input.actorSession,
            approvedAt,
            onBehalfOf: input.onBehalfOf ?? null,
            actionId,
            freezeFired: false,
            reApproved: isReApprove,
            ...(isReApprove && priorApprovedBy !== null
                ? { priorApprovedBy, priorApprovedAt }
                : {}),
        };
    }
}
// ——— frontmatter helpers (daemon-side mirror of the CLI scope-fs shape:
// hand-rolled split + YAML.parse, safe-by-default per PRD §4 leg 2) ———
function parseFrontmatter(content) {
    if (!content.startsWith("---"))
        return {};
    const match = /^---\s*\n([\s\S]*?)\n---/.exec(content);
    if (!match)
        return {};
    try {
        const parsed = YAML.parse(match[1]);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
/** Reads the slice IMPLEMENTATION-PRD.md; returns null on ANY missing/unreadable
 *  error (never throws) — the plan-lock derivation fails open to a PRD-only set. */
function tryReadPRD(sliceDir) {
    try {
        return fs.readFileSync(path.join(sliceDir, "IMPLEMENTATION-PRD.md"), "utf8");
    }
    catch {
        return null;
    }
}
/** B14 — the stamper's explicit plan-lock set: slice-relative, normalized by the SAME rules as the
 *  derived path (no scheme/absolute/escape), each file verified to EXIST — a chosen set naming a
 *  missing file is the same defect the explicit path exists to end. Dedup, first wins. */
function resolveExplicitPlanLockArtifacts(raw, sliceDir, scopePath) {
    const out = [];
    const seen = new Set();
    for (const ref of raw) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
            throw new ScopeApproveError("locked_artifact_invalid", `${scopePath}: locked artifact "${ref}" carries a URI scheme — every locked-artifact path is slice-relative.`, { scopePath, ref });
        }
        const norm = sliceRelativeMediaPath(ref, "");
        if (norm === null) {
            throw new ScopeApproveError("locked_artifact_invalid", `${scopePath}: locked artifact "${ref}" is absolute or escapes the slice directory — every locked-artifact path is slice-relative.`, { scopePath, ref });
        }
        if (!fs.existsSync(path.join(sliceDir, norm))) {
            throw new ScopeApproveError("locked_artifact_missing", `${scopePath}: locked artifact "${norm}" does not exist in the slice directory — a chosen set must name real files.`, { scopePath, ref: norm });
        }
        if (seen.has(norm))
            continue;
        seen.add(norm);
        out.push({ name: norm, path: norm, kind: "spec" });
    }
    return out;
}
/** P15 (WRITER-EXCEEDS-ITS-OWNERSHIP fix, PM-ruled 2026-08-07): the stamp is
 *  sole-writer of its OWN keys and must byte-preserve every line it does not
 *  own. The old implementation parsed and RE-SERIALIZED the whole block, so
 *  stamping invalidated any seal taken over the file — seal-then-lock broke by
 *  construction. Now: each owned key is serialized alone and spliced in by
 *  index (replace-in-place when the key exists, append at the block end when
 *  absent). Unowned bytes — folded scalars, quoting style, ordering — are
 *  untouched, so stripping exactly the owned lines restores the pre-stamp
 *  bytes. Index splicing (never String.replace with a dynamic replacement)
 *  keeps $-metacharacters in values inert. */
function writeFrontmatterFields(content, fields) {
    const match = /^---\s*\n([\s\S]*?)\n---/.exec(content);
    if (!match) {
        const yaml = YAML.stringify(fields).trimEnd();
        return `---\n${yaml}\n---\n\n${content}`;
    }
    let block = match[1];
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined)
            continue;
        const rendered = YAML.stringify({ [key]: value }).trimEnd();
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // a top-level `key:` line plus its indented continuation lines (nested blocks)
        const keyRe = new RegExp(`^${escaped}:[^\\n]*(?:\\n[ \\t]+[^\\n]*)*`, "m");
        const existing = keyRe.exec(block);
        if (existing) {
            block = block.slice(0, existing.index) + rendered + block.slice(existing.index + existing[0].length);
        }
        else {
            block = block.length > 0 ? `${block}\n${rendered}` : rendered;
        }
    }
    return content.slice(0, match.index) + `---\n${block}\n---` + content.slice(match.index + match[0].length);
}
//# sourceMappingURL=scope-approve.js.map