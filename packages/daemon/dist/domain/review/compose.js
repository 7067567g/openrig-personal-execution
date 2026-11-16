// Living Notes — the deterministic composer (OPR.0.4.4.20, rebuilt per the
// CORRECTIVE REDESIGN of 2026-07-05).
//
// PURE: `(gathered inputs) -> composed doc`. Same inputs (including the
// caller-supplied view-time facts nowIso/mainTip/git facts) -> byte-identical
// output. Every section has a named SSOT and a degrade value; a missing
// source renders its degrade, never invented content. The gatherer that
// assembles inputs from disk/queue/git lives beside this file; keeping the
// core pure is what makes the idempotence AC hold by construction.
//
// CORRECTIVE §3.1 — the composer builds ONE renderable structure per slice:
// the INTENT → PLAN → DELIVERED stack. It no longer emits `sections`,
// `acceptance`, `compare`, `join`, or a coequal `green` field. The
// recorded-verdict rigor behind the old green lives on in two places only:
// the per-deliverable `verified` signal (§11) and the mission ledger's
// completion green (FR-7 — a mission-altitude fact, not a slice structure).
import YAML from "yaml";
import { findFrontmatterBlock } from "../frontmatter.js";
import { createHash } from "node:crypto";
import * as posixPath from "node:path/posix";
import { renderBriefSpine } from "./brief-spine.js";
import { C1_ARTIFACT_TYPES, C1_VERDICTS, GATE_ROLES, PHASE_LANE_LABELS, } from "./types.js";
import { isScaffoldPlaceholderText, hasAuthoredNumberedItem, isPlaceholderOnlyBlock, isPristineScaffoldSection, selectProofContractBody, } from "../scope/scaffold-placeholder.js";
import { parseLogicalCheckboxes } from "../scope/logical-checkbox.js";
// --- Fixed, visible v1 thresholds (markdown-steered tuning is a named fast-follow) ---
export const IDLE_WITH_WORK_THRESHOLD_MIN = 30;
// ---------------------------------------------------------------------------
// Media refs (shared shape helpers — pure string work, no filesystem)
// ---------------------------------------------------------------------------
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v"]);
function extOf(ref) {
    const clean = ref.split(/[?#]/)[0];
    const i = clean.lastIndexOf(".");
    return i === -1 ? "" : clean.slice(i).toLowerCase();
}
export function mediaKind(ref) {
    const ext = extOf(ref);
    if (IMAGE_EXTS.has(ext))
        return "image";
    if (VIDEO_EXTS.has(ext))
        return "video";
    return null;
}
/** Markdown/HTML media refs in a source string (http(s) refs excluded —
 *  media is co-located slice content, FR-5). */
export function extractMediaRefs(markdown) {
    if (!markdown)
        return [];
    const refs = [];
    const re = /!\[[^\]]*\]\(([^)]+)\)|<(?:video|img|source)[^>]*\ssrc="([^"]+)"/g;
    for (const m of markdown.matchAll(re)) {
        const ref = (m[1] ?? m[2] ?? "").trim();
        if (ref && !ref.startsWith("http"))
            refs.push(ref);
    }
    return refs;
}
/** Normalizes a media ref written relative to `baseDir` (slice-relative "")
 *  into a slice-relative path. Returns null when the ref is absolute or
 *  escapes the slice dir — the caller records the defect (FR-5), never a
 *  silent drop. */
export function sliceRelativeMediaPath(ref, baseDir) {
    if (ref.startsWith("/"))
        return null;
    const joined = baseDir ? posixPath.join(baseDir, ref) : ref;
    const normalized = posixPath.normalize(joined);
    if (normalized === ".." || normalized.startsWith("../"))
        return null;
    return normalized;
}
function toReviewMedia(ref, baseDir) {
    const kind = mediaKind(ref);
    if (!kind)
        return null;
    const src = sliceRelativeMediaPath(ref, baseDir);
    if (!src)
        return null;
    return { kind, src, caption: ref };
}
function dedupMedia(media) {
    const seen = new Set();
    return media.filter((m) => {
        if (seen.has(m.src))
            return false;
        seen.add(m.src);
        return true;
    });
}
// ---------------------------------------------------------------------------
// C1 header parsing
// ---------------------------------------------------------------------------
/** Parses a proof artifact's YAML frontmatter into a ProofArtifact.
 *  Out-of-set / missing verdicts become null (a present artifact is not a
 *  verdict — FR-2); the parse never throws on malformed input. Body media
 *  refs are captured for the §3.4 curated-proof projection. */
export function parseC1Header(content, relPath, droppedAtIso) {
    const out = {
        relPath,
        slice: null,
        candidateSha: null,
        artifactType: null,
        verdict: null,
        moneyEvidence: null,
        evidences: [],
        selfCheck: null,
        mediaRefs: [],
        droppedAt: droppedAtIso,
    };
    const block = findFrontmatterBlock(content);
    out.mediaRefs = extractMediaRefs(block ? content.slice(block.bodyStart) : content);
    if (!block)
        return out;
    let fm;
    try {
        fm = (YAML.parse(block.yaml) ?? {});
    }
    catch {
        return out;
    }
    const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : v != null && typeof v !== "object" ? String(v) : null);
    out.slice = str(fm["slice"]);
    out.candidateSha = str(fm["candidate_sha"]);
    const at = str(fm["artifact_type"]);
    out.artifactType = at && C1_ARTIFACT_TYPES.includes(at) ? at : null;
    const v = str(fm["verdict"]);
    out.verdict = v && C1_VERDICTS.includes(v) ? v : null;
    out.moneyEvidence = str(fm["money_evidence"]);
    out.selfCheck = str(fm["self_check"]);
    const ev = fm["evidences"];
    if (Array.isArray(ev))
        out.evidences = ev.map((e) => String(e)).filter((e) => e.trim().length > 0);
    return out;
}
// ---------------------------------------------------------------------------
// FR-2 — verdict selection, pass-mapping, lineage (KEEP)
// ---------------------------------------------------------------------------
/** The pinned pass-mapping ("passing" is never left to interpretation). */
export function isPassing(artifactType, verdict) {
    if (verdict === null)
        return false;
    if (artifactType === "qa")
        return verdict === "PASS";
    if (artifactType === "adjudication")
        return verdict === "CLEAR" || verdict === "PASS";
    // guard, rev1-r1, rev1-r2
    return verdict === "CLEAR";
}
function toneFor(artifactType, verdict) {
    if (verdict === null)
        return "unknown";
    return isPassing(artifactType, verdict) ? "pass" : "fail";
}
/** Latest-wins per (candidate_sha, artifact_type) — the ratified C1 selection
 *  rule. A non-passing verdict is superseded only by a LATER artifact of the
 *  SAME tuple, never by adjacent artifacts, presence, or approval. */
export function selectWinning(artifacts, candidateSha) {
    const winning = new Map();
    for (const a of artifacts) {
        if (!a.artifactType)
            continue;
        if (candidateSha !== null && a.candidateSha !== candidateSha)
            continue;
        const prev = winning.get(a.artifactType);
        if (!prev || a.droppedAt > prev.droppedAt || (a.droppedAt === prev.droppedAt && a.relPath > prev.relPath)) {
            winning.set(a.artifactType, a);
        }
    }
    return winning;
}
/** The candidate under judgment: the candidate_sha of the latest-dropped gate
 *  artifact (deterministic; ties broken by relPath). Null when no artifact
 *  carries one. */
export function deriveCandidateSha(artifacts) {
    let best = null;
    for (const a of artifacts) {
        if (!a.candidateSha || !a.artifactType || a.artifactType === "adjudication")
            continue;
        if (!best || a.droppedAt > best.droppedAt || (a.droppedAt === best.droppedAt && a.relPath > best.relPath))
            best = a;
    }
    return best?.candidateSha ?? null;
}
export function deriveGateCells(artifacts, candidateSha) {
    const winning = selectWinning(artifacts, candidateSha);
    return GATE_ROLES.map((role) => {
        const a = winning.get(role);
        if (!a || a.verdict === null) {
            return { role, recordedToken: null, tone: "unknown", state: "missing", source: a?.relPath ?? null };
        }
        return {
            role,
            recordedToken: a.verdict,
            tone: toneFor(role, a.verdict),
            state: isPassing(role, a.verdict) ? "passing" : "non-passing",
            source: a.relPath,
        };
    });
}
/** Near-tip tolerance for the pre-merge fresh label. */
const FRESH_BEHIND_TOLERANCE = 3;
export function composeLineage(candidateSha, git, gateCells) {
    let freshness = "unknown";
    let staleBehind = null;
    if (git.mergeSha !== null) {
        if (git.mergeIsAncestorOfTip !== null)
            freshness = git.mergeIsAncestorOfTip ? "fresh" : "stale";
    }
    else if (candidateSha !== null && git.candidateBehindTip !== null) {
        if (git.candidateBehindTip <= FRESH_BEHIND_TOLERANCE) {
            freshness = "fresh";
        }
        else {
            freshness = "stale";
            staleBehind = git.candidateBehindTip;
        }
    }
    return { candidateSha, mergeSha: git.mergeSha, mainTip: git.mainTip, freshness, staleBehind, gateCells };
}
export function lockFrom(stamp) {
    if (!stamp)
        return null;
    return { by: stamp.by, at: stamp.at, auditVerified: stamp.auditRowPresent };
}
export function computeRecordedGreen(gateCells, artifacts, candidateSha) {
    if (gateCells.every((c) => c.state === "passing"))
        return { green: true, regime: 1 };
    const adjudication = selectWinning(artifacts, candidateSha).get("adjudication");
    if (adjudication && isPassing("adjudication", adjudication.verdict))
        return { green: true, regime: 2 };
    return { green: false, regime: null };
}
/** Convenience for the mission gatherer: derive the ledger green straight
 *  from a slice's artifacts (candidate + gate cells derived internally). */
export function composeRecordedGreenForSlice(artifacts) {
    const candidateSha = deriveCandidateSha(artifacts);
    return computeRecordedGreen(deriveGateCells(artifacts, candidateSha), artifacts, candidateSha);
}
// ---------------------------------------------------------------------------
// FR-1 — markdown structure extraction (KEEP the extractors; the sections/
// acceptance/compare structures they used to feed are gone)
// ---------------------------------------------------------------------------
/** Extracts a `## <heading>` section body, verbatim (character-identical). */
export function extractSection(markdown, heading) {
    if (!markdown)
        return null;
    const re = new RegExp(`^##\\s+${heading}\\s*$`, "im");
    const m = re.exec(markdown);
    if (!m)
        return null;
    const start = m.index + m[0].length;
    const rest = markdown.slice(start);
    const next = rest.search(/^##?\s/m);
    const body = next === -1 ? rest : rest.slice(0, next);
    return body.replace(/^\n+/, "").replace(/\s+$/, "");
}
/** The pinned mini-requirements tier at the PRD top (plan.concise.text). */
export function extractMiniReqs(prd) {
    return extractSection(prd, "Mini-requirements(?:[^\\n]*)?");
}
/** release-0.4.7 intent-stage — true when the (already-extracted) mini-reqs
 *  section carries at least one numbered item whose text is NOT a scaffold
 *  placeholder (the template scaffolds `1. [...]`).
 *
 *  SINGLE-PARSE PIN (arch AR-2): the derivePhase `prdAuthored` signal AND the
 *  PLAN concise render decision MUST both derive from this ONE parse of the
 *  ONE extractMiniReqs extraction — a second mini-reqs grammar anywhere in
 *  this file would recreate the seam map's R3 divergence class intra-file.
 *
 *  release-0.4.7 micro-bundle A: the LINE grammar now lives in the twin
 *  module's `hasAuthoredNumberedItem` (shared with both scope-audit mini-reqs
 *  arms — the IF-3 dot/paren heal, arch MB-AR-1); this function keeps the
 *  parse-side contract above and delegates the grammar. Prose/bullet-only is
 *  deliberately not-authored — reviewer-L1 ruling 2026-07-11, intent-stage
 *  gate: the numbered tier is where approval starts. */
export function hasAuthoredMiniReqs(miniReqs) {
    return hasAuthoredNumberedItem(miniReqs);
}
// KI-5.3-2 — the logical-checkbox grammar (LogicalCheckboxItem +
// parseLogicalCheckboxes) now lives in the twinned module
// ../scope/logical-checkbox.ts, byte-equal with the CLI so `rig proof add`
// indexes the SAME items this composer renders. Re-exported here so existing
// readers (slice-detail-projector) keep importing it from the composer; the
// ONE parse is unchanged.
export { parseLogicalCheckboxes };
/** Shared identity for judgment authority and readers; preserve existing receipt hashes. */
export function proofItemIdentity(rawText) {
    const declared = /<!--\s*proof-item:\s*([a-zA-Z0-9_-]+)\s*-->/.exec(rawText);
    const text = rawText.replace(/<!--\s*proof-item:\s*[a-zA-Z0-9_-]+\s*-->/g, "").trim();
    return { id: declared?.[1] ?? `item-${createHash("sha256").update(JSON.stringify(text)).digest("hex").slice(0, 20)}`, text };
}
export function extractProofContract(prd) {
    const body = extractSection(prd, "Proof contract");
    if (!body)
        return [];
    const items = [];
    // ONE parse: the shared logical-checkbox relation (continuations joined).
    for (const logical of parseLogicalCheckboxes(body)) {
        // release-0.4.7 intent-stage: a scaffold-template placeholder row is not
        // a promise — a pristine contract extracts to [] so DELIVERED renders its
        // honest empty copy instead of "missing" rows (shared grammar:
        // ../scope/scaffold-placeholder.ts).
        if (isScaffoldPlaceholderText(logical.rawText))
            continue;
        // The authored bytes are the record's rawText — the VM-006 key. Display
        // text derives FROM it (image stripped); the key itself stays pre-strip.
        const rawText = logical.rawText;
        let text = rawText;
        let plannedRef = null;
        const img = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
        if (img) {
            plannedRef = img[1].trim();
            text = text.replace(img[0], "").replace(/\s{2,}/g, " ").trim();
        }
        items.push({ text, rawText, plannedRef });
    }
    return items;
}
// ---------------------------------------------------------------------------
// PM dogfood #1 (qitem-20260720015700-630eef64) — per-SECTION source
// selection, shared by this composer and the slice-detail projector: an
// authored PRD section is canonical, but a PRESENT-and-PRISTINE scaffold-only
// PRD section yields to an authored (non-pristine) README section. Missing /
// prose-malformed / mixed-authored PRD sections stay PRD-canonical
// (isPristineScaffoldSection(null) is false — a missing section never
// triggers fallback). Status-blind: no lifecycle status is read. The
// existing extractors are unchanged; these wrap them.
// ---------------------------------------------------------------------------
export function extractMiniReqsSelected(prd, readme, spec = null) {
    if (spec !== null)
        return { body: extractMiniReqs(spec), fromReadme: false };
    const prdBody = extractMiniReqs(prd);
    if (isPristineScaffoldSection(prdBody)) {
        const readmeBody = extractMiniReqs(readme);
        if (readmeBody !== null && !isPristineScaffoldSection(readmeBody))
            return { body: readmeBody, fromReadme: true };
    }
    return { body: prdBody, fromReadme: false };
}
// KI-5.3-2 second face (row e69daaef): source selection is ONE-HOMED in the
// scaffold-placeholder twin (selectProofContractBody) so this reader, the
// scope-audit twins, and proof-add can never diverge on the fallback target
// again (the confirmed split-brain: proof-add derived from SPEC while this
// reader fell back to README with no SPEC path). The optional `spec` param
// keeps legacy 2-arg callers compiling; they get the shipped README-only
// behavior until threaded.
export function extractProofContractSelected(prd, readme, spec = null) {
    const selection = selectProofContractBody({
        prdBody: extractSection(prd, "Proof contract"),
        specBody: extractSection(spec, "Proof contract"),
        readmeBody: extractSection(readme, "Proof contract"),
    });
    if (selection.source === "spec")
        return { items: extractProofContract(spec), fromReadme: false, source: "spec" };
    if (selection.source === "readme")
        return { items: extractProofContract(readme), fromReadme: true, source: "readme" };
    // source "prd" (authored) or null (nothing authored): the shipped behavior —
    // parse the PRD; a pristine/absent PRD yields its own (empty/placeholder)
    // item set, and `source` tells the caller which state it is in.
    const authoredPrd = !isPristineScaffoldSection(extractSection(prd, "Proof contract"));
    return { items: extractProofContract(prd), fromReadme: false, source: authoredPrd && prd !== null ? "prd" : null };
}
/** Top-down by precedence — locked > review > building > spec > intent —
 *  stated explicitly because one signal can satisfy two lanes.
 *
 *  The phase chip describes SDLC ARTIFACT progression, not coordination
 *  activity (arch AR-3): a bare tracking qitem is coordination and counts
 *  toward building only when paired with an authored/locked spec;
 *  coordination itself renders in the queue/agents bands. */
export function derivePhase(s) {
    if (s.approved)
        return "locked";
    if (s.verdictOrEvidenceSetPresent)
        return "review";
    if (s.realProofArtifactsPresent || (s.activeQitemPresent && (s.specLocked || s.prdAuthored)))
        return "building";
    if (s.prdAuthored || s.specLocked)
        return "spec";
    return "intent";
}
// ---------------------------------------------------------------------------
// §3.1 DELIVERED — the redesigned join: planned ↔ curated proof ↔ verified
// ---------------------------------------------------------------------------
/** An `evidences:` ref matches a promised item by exact text or 1-based index. */
function refMatches(ref, promised, index) {
    const trimmed = ref.trim();
    return trimmed === promised[index].text || trimmed === String(index + 1);
}
/**
 * `delivered.items` IS the join, reframed (§3.1): each `## Proof contract`
 * deliverable pairs with the CURATED proof media of the artifacts covering it
 * and QA's recorded comparison signal.
 *
 * `verified` binds to the SHIPPED C1 fields (arch F3), never presence:
 *   verified   — a covering qa|adjudication artifact records the comparison
 *                (self_check) AND its recorded verdict is passing;
 *   unverified — some covering artifact exists but no passing recorded QA
 *                comparison (QA's why-kicked-back note still surfaces);
 *   missing    — promised, nothing delivered.
 * Fail-open by construction: these are render states, never blocks.
 */
export function composeDelivered(promised, artifacts, readiness) {
    const escaping = new Set();
    const mediaOf = (a) => {
        const out = [];
        for (const ref of a.mediaRefs) {
            const m = toReviewMedia(ref, "proof");
            if (m)
                out.push(m);
            else if (mediaKind(ref))
                escaping.add(ref);
        }
        return out;
    };
    const byLatest = (a, b) => a.droppedAt < b.droppedAt ? 1 : a.droppedAt > b.droppedAt ? -1 : a.relPath.localeCompare(b.relPath);
    const covered = new Set();
    const items = promised.map((p, i) => {
        const covering = artifacts.filter((a) => a.evidences.some((ref) => refMatches(ref, promised, i))).sort(byLatest);
        covering.forEach((a) => covered.add(a.relPath));
        const qaCovering = covering.filter((a) => a.artifactType === "qa" || a.artifactType === "adjudication");
        const winners = selectWinning(covering, deriveCandidateSha(covering));
        const verifiedBy = qaCovering.find((a) => a.artifactType !== null && winners.get(a.artifactType) === a && a.selfCheck !== null && isPassing(a.artifactType, a.verdict));
        const noteSource = qaCovering.find((a) => a.selfCheck !== null) ?? covering.find((a) => a.selfCheck !== null);
        const plannedRef = p.plannedRef ? toReviewMedia(p.plannedRef, "") : null;
        if (p.plannedRef && !plannedRef && mediaKind(p.plannedRef))
            escaping.add(p.plannedRef);
        const item = {
            promised: plannedRef ? { text: p.text, plannedRef } : { text: p.text },
            proof: dedupMedia(covering.flatMap(mediaOf)),
            verified: verifiedBy ? "verified" : covering.length > 0 ? "unverified" : "missing",
        };
        const note = noteSource?.selfCheck ?? null;
        if (note)
            item.note = note;
        if (readiness?.configured) {
            const current = readiness.items.find(i => i.id === proofItemIdentity(p.rawText).id);
            item.verified = current?.state === "accepted" && !readiness.issues.length ? "verified" : current?.judgment || covering.length ? "unverified" : "missing";
            item.note = current ? `Judgment ${current.state}: ${current.reason}` : `Current judgment unavailable: ${readiness.issues.join("; ")}`;
        }
        else if (verifiedBy)
            item.note = `Legacy recorded verification (item revision unbound). ${item.note ?? ""}`.trim();
        return item;
    });
    // Helpful-but-unmapped artifacts (§6): their media renders bounded under
    // the extraProof label — visible, never dropped, never a primary-view pile.
    const extraProof = dedupMedia(artifacts
        .filter((a) => !covered.has(a.relPath))
        .sort(byLatest)
        .flatMap(mediaOf));
    return {
        items,
        extraProof,
        missingCount: items.filter((it) => it.verified === "missing").length,
        escapingRefs: [...escaping].sort(),
    };
}
function minutesBetween(aIso, bIso) {
    return Math.floor((Date.parse(bIso) - Date.parse(aIso)) / 60_000);
}
/** The four ▲ exception rules over captured signals. Every row carries its
 *  evidence + crossed threshold; no evidence -> no exception (never a bare
 *  accusation). A ▲ is information for the human, invisible to the flagged
 *  agent's workflow. */
export function deriveExceptions(agents, attention, delivered, scopeLabel, nowIso, latestArtifactIso, governingStampIso) {
    const items = [];
    const push = (identity, summary, d) => {
        items.push({
            source: "derived",
            identity,
            summary,
            leg: d.kind,
            where: scopeLabel,
            ageIso: null,
            priority: null,
            tier: null,
            evidenceRef: null,
            unblocks: null,
            qitemId: null,
            destinationSession: null,
            derived: d,
        });
    };
    for (const a of agents) {
        if (a.idle === true && a.holdsCount > 0 && a.idleSinceIso) {
            const idleMin = minutesBetween(a.idleSinceIso, nowIso);
            if (idleMin >= IDLE_WITH_WORK_THRESHOLD_MIN) {
                push(`${a.sessionName}|stuck|${a.idleSinceIso}`, `${a.agentName} looks stuck`, {
                    kind: "stuck",
                    evidence: `idle ${idleMin}m >= ${IDLE_WITH_WORK_THRESHOLD_MIN}m default · holds ${a.holdsCount}`,
                    threshold: `idle-with-work >= ${IDLE_WITH_WORK_THRESHOLD_MIN}m`,
                });
            }
        }
    }
    for (const q of attention) {
        if (q.closureRequiredAtIso && q.closureRequiredAtIso < nowIso) {
            push(`${q.qitemId}|overdue|${q.closureRequiredAtIso}`, `${q.summary ?? q.qitemId} is overdue`, {
                kind: "overdue",
                evidence: `closure required at ${q.closureRequiredAtIso} · now ${nowIso}`,
                threshold: "past closure_required_at",
            });
        }
    }
    if (delivered.promisedCount > 0 && delivered.missingCount > 0) {
        push(`${scopeLabel}|insufficient-proof|${delivered.missingCount}`, `insufficient proof: ${delivered.missingCount}/${delivered.promisedCount} promised items missing`, {
            kind: "insufficient-proof",
            evidence: `${delivered.missingCount} of ${delivered.promisedCount} promised deliverables have no delivered evidence`,
            threshold: "delivered.items MISSING count > 0",
        });
    }
    if (latestArtifactIso && governingStampIso && latestArtifactIso > governingStampIso) {
        push(`${scopeLabel}|stale-after-change|${latestArtifactIso}`, "artifacts changed after the governing stamp", {
            kind: "stale-after-change",
            evidence: `artifact at ${latestArtifactIso} is newer than the stamp at ${governingStampIso}`,
            threshold: "artifact newer than governing stamp",
        });
    }
    return items;
}
export function composeNeedsYou(attention, derived, confirmFaithful, computedOver, nowIso) {
    const agentItems = attention.map((q) => ({
        source: "agent",
        // OPR.0.4.6.WF4 Q6 — carry the gatherer's pointer verbatim; OMITTED for
        // non-workflow items (byte-identity-by-omission).
        ...(q.workflow ? { workflow: q.workflow } : {}),
        identity: q.qitemId,
        summary: q.summary ?? q.qitemId,
        leg: q.leg,
        where: q.where,
        ageIso: q.createdAtIso,
        priority: q.priority,
        tier: q.tier,
        evidenceRef: q.evidenceRef,
        unblocks: q.unblocks,
        qitemId: q.qitemId,
        destinationSession: q.destinationSession,
        derived: null,
    }));
    // One-count identity rule: distinct identities within this scope only.
    const seen = new Set();
    const all = [...agentItems, ...confirmFaithful, ...derived].filter((i) => {
        if (seen.has(i.identity))
            return false;
        seen.add(i.identity);
        return true;
    });
    // Priority-ordered, most-consequential-first: explicit priority rank, then age.
    const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
    all.sort((a, b) => {
        const ra = rank[a.priority ?? "normal"] ?? 2;
        const rb = rank[b.priority ?? "normal"] ?? 2;
        if (ra !== rb)
            return ra - rb;
        return (a.ageIso ?? "9999") < (b.ageIso ?? "9999") ? -1 : 1;
    });
    return {
        items: all,
        provenance: all.length === 0
            ? `0 attention items · 0 parks · 0 unconfirmed proofs — computed from ${computedOver} at ${nowIso}`
            : `computed from ${computedOver} at ${nowIso}`,
    };
}
/**
 * OPR.0.4.6.WF5 FR-3 — the workflow_instances ▲ source + THE AWARENESS
 * CHANNEL. One-count across channels (BR-3): an exception with a live
 * HUMAN-routed ● item renders NOTHING here (the item IS the human's
 * row); an ORCHESTRATOR-routed ● item renders exactly ONE awareness row
 * (same identity, second projection — the human KNOWS at altitude); a
 * failed instance with NO item renders the ▲ backstop naming BOTH the
 * exception AND the missing-item anomaly (the backstop firing is itself
 * evidence of a bug). Healthy instances render zero rows (the band's
 * zero-noise negative). Durable-by-derivation: recomputed from recorded
 * state on every composition; rows clear on state-exit (recomposition,
 * never hand-clearing).
 */
export function deriveWorkflowExceptions(workflows, scopeLabel, nowIso) {
    const items = [];
    const push = (identity, summary, d, evidenceRef, workflow) => {
        items.push({
            source: "derived",
            // OPR.0.4.6.WF4 Q6 — every derived workflow row carries the pointer.
            workflow,
            identity,
            summary,
            leg: d.kind,
            where: scopeLabel,
            ageIso: null,
            priority: null,
            tier: null,
            evidenceRef,
            unblocks: null,
            qitemId: null,
            destinationSession: null,
            derived: d,
        });
    };
    for (const w of workflows) {
        const trace = `rig workflow trace ${w.instanceId}`;
        // OPR.0.4.6.WF4 Q6 — the pointer for every row this instance emits;
        // identity derived exactly once, here (never from prose downstream).
        const wref = {
            instanceId: w.instanceId,
            workflowName: w.workflowName,
            ...(w.currentStepId ? { stepId: w.currentStepId } : {}),
        };
        // The anomaly backstop fires regardless of item state — the
        // corruption is orthogonal to exception routing.
        if (w.frontierRefsNonOpenPacket) {
            push(`${w.instanceId}|anomaly|frontier-non-open`, `${w.workflowName} instance frontier references a closed packet`, {
                kind: "anomaly",
                evidence: `instance ${w.instanceId} frontier points at a non-open packet — out-of-band closure got past the WF-3 close-path guard`,
                threshold: "frontier packet must be open",
            }, trace, wref);
        }
        const exceptional = w.status === "failed" || (w.deadlineState !== "healthy" && w.deadlineEvidence !== null);
        if (!exceptional)
            continue;
        const kindLabel = w.status === "failed" ? "failed" : w.deadlineState;
        if (w.openItem && w.openItem.humanRouted) {
            // The ● item already sits in the human attention legs — a row
            // here would double-render (one-count).
            continue;
        }
        if (w.openItem) {
            // ORCHESTRATOR-routed: the awareness row — holder + age +
            // evidence; awareness, not assignment. Same recorded identity as
            // the ● item, projected into the human band.
            const ageMin = w.openItem.createdAtIso ? minutesBetween(w.openItem.createdAtIso, nowIso) : null;
            push(`${w.instanceId}|awareness|${w.openItem.qitemId}`, `awareness: ${w.workflowName} ${kindLabel} — held by ${w.openItem.destinationSession}`, {
                kind: "awareness",
                evidence: `exception item ${w.openItem.qitemId} on ${w.openItem.destinationSession}${ageMin !== null ? ` for ${ageMin}m` : ""}${w.openItem.summary ? ` — ${w.openItem.summary}` : ""}`,
                threshold: "awareness (orchestrator acting; step in any time)",
            }, trace, wref);
            continue;
        }
        // NO item: the ▲ backstop — names the exception AND the anomaly of
        // the missing item.
        push(`${w.instanceId}|workflow-${kindLabel}|no-item`, `${w.workflowName} instance ${kindLabel} with NO exception item`, {
            kind: w.status === "failed" ? "workflow-failed" : "stuck",
            evidence: `${w.deadlineEvidence ?? `instance ${w.instanceId} is ${kindLabel} at step ${w.currentStepId ?? "?"}`} · MISSING-ITEM ANOMALY: the never-lost channel produced no item (itself a bug — report it)`,
            threshold: w.status === "failed" ? "failed instances carry an exception item" : "past the WF-1 deadline evaluator threshold",
        }, trace, wref);
    }
    return items;
}
/** The third NAMED ▲ heuristic's visible v1 default (slice-22 FR-3:
 *  too-long-in-state — no transition beyond threshold). Lives HERE because
 *  compose.ts is the single threshold home (P2 arch note N2): changes land
 *  once and every altitude inherits. Same markdown-steered tuning
 *  fast-follow as IDLE_WITH_WORK_THRESHOLD_MIN. */
export const TOO_LONG_IN_STATE_THRESHOLD_MIN = 120;
/**
 * Slice-22 FR-3 — the agent-scope ▲ set: exactly the three NAMED heuristics
 * (idle-with-assigned-work, overdue handoff, too-long-in-state). The first
 * two REUSE deriveExceptions' rules (called with zero delivered counts and
 * no artifact/stamp facts, so the slice-only insufficient-proof /
 * stale-after-change rules cannot fire); too-long-in-state is added here —
 * additively, so slice-scope composition is byte-unchanged. No evidence →
 * no exception (unknown is not idle; unknown lastTransition is not
 * too-long).
 */
export function deriveAgentScopeExceptions(agents, attention, scopeLabel, nowIso) {
    const items = deriveExceptions(agents, attention, { promisedCount: 0, missingCount: 0 }, scopeLabel, nowIso, null, null);
    for (const a of agents) {
        if (a.holdsCount > 0 && a.lastTransitionIso) {
            const sinceMin = minutesBetween(a.lastTransitionIso, nowIso);
            if (sinceMin >= TOO_LONG_IN_STATE_THRESHOLD_MIN) {
                items.push({
                    source: "derived",
                    identity: `${a.sessionName}|too-long-in-state|${a.lastTransitionIso}`,
                    summary: `${a.agentName} has not transitioned in ${sinceMin}m`,
                    leg: "stuck",
                    where: scopeLabel,
                    ageIso: null,
                    priority: null,
                    tier: null,
                    evidenceRef: null,
                    unblocks: null,
                    qitemId: null,
                    destinationSession: null,
                    derived: {
                        kind: "stuck",
                        evidence: `no transition for ${sinceMin}m >= ${TOO_LONG_IN_STATE_THRESHOLD_MIN}m default · holds ${a.holdsCount}`,
                        threshold: `too-long-in-state >= ${TOO_LONG_IN_STATE_THRESHOLD_MIN}m`,
                    },
                });
            }
        }
    }
    return items;
}
/** Slice-22 FR-1..FR-4 — the rig-scope composition root. PURE: same inputs,
 *  byte-identical output (idempotence is a money proof). */
export function composeRigAgents(inputs) {
    const { nowIso } = inputs;
    const scopeLabel = "rig";
    const derived = [
        ...deriveAgentScopeExceptions(inputs.agents, inputs.overdue, scopeLabel, nowIso),
        ...deriveWorkflowExceptions(inputs.workflows ?? [], scopeLabel, nowIso),
    ];
    const needsYou = composeNeedsYou(inputs.attention, derived, [], `queue+ps (rig scope) · window: ${inputs.rosterWindow}`, nowIso);
    const band = composeAgentsBand(inputs.agents, "rig", derived, nowIso);
    return {
        scope: "rig",
        needsYou,
        agents: {
            ...band,
            provenance: band.rows.length === 0
                ? `no agents holding or recently holding work — computed from queue+ps · window: ${inputs.rosterWindow} · at ${nowIso}`
                : `computed from queue+ps · window: ${inputs.rosterWindow} · at ${nowIso}`,
            // FR-4: one health line per scope, from the transitions log.
            coordinationHealth: `${inputs.handoffsToday} handoffs today · ${inputs.overdueCount} overdue`,
        },
        settled: inputs.settled,
        settledProvenance: inputs.settled.length === 0
            ? `0 handoffs today — computed from queue transitions · window: today · at ${nowIso}`
            : `computed from queue transitions · window: today · at ${nowIso}`,
        composedAt: nowIso,
    };
}
/** Region membership derives from work-on-THIS-scope, never rig co-residency. */
export function composeAgentsBand(agents, scope, exceptions, nowIso) {
    const rows = agents.map((a) => {
        const ex = exceptions.find((e) => e.derived && e.identity.startsWith(`${a.sessionName}|`));
        return {
            agentName: a.agentName,
            runtime: a.runtime,
            stateGlyph: a.parkedOn ? "parked" : a.idle === null ? "unknown" : a.idle ? "idle" : "active",
            doing: a.doing,
            holdsCount: a.holdsCount,
            lastTransitionIso: a.lastTransitionIso,
            exception: ex?.derived ?? null,
            sessionName: a.sessionName,
            slices: a.slices,
        };
    });
    return {
        scope,
        rows,
        provenance: rows.length === 0
            ? `no agents holding or recently holding work — computed from queue at ${nowIso}`
            : `computed from queue at ${nowIso}`,
        coordinationHealth: null,
    };
}
/** A self-asserted PASS in the slice's own PROOF.md (never a verdict). */
export function proofClaimsPass(proofMd) {
    if (!proofMd)
        return false;
    return proofMd
        .split(/\r?\n/)
        .some((line) => /^\s*(?:Closed by:.*\bVerdict:|Verdict:|Result:)\s*PASS\b/i.test(line));
}
function sectionMedia(sectionBody, escaping) {
    const out = [];
    for (const ref of extractMediaRefs(sectionBody)) {
        const m = toReviewMedia(ref, "");
        if (m)
            out.push(m);
        else if (mediaKind(ref))
            escaping.add(ref);
    }
    return out;
}
export function composeSliceReview(inputs) {
    const { slice, nowIso } = inputs;
    const sliceRef = `${slice.missionId ?? "?"}/slices/${slice.name}`;
    const candidateSha = deriveCandidateSha(inputs.artifacts);
    const gateCells = deriveGateCells(inputs.artifacts, candidateSha);
    const lineage = composeLineage(candidateSha, inputs.git, gateCells);
    const planLock = lockFrom(inputs.approval.spec);
    const deliveredLock = lockFrom(inputs.approval.delivery);
    const escaping = new Set();
    // release-0.4.7 micro-bundle B: a placeholder-only Intent section (the
    // shipped template scaffolds it as one fully-bracket-wrapped line) is
    // treated as ABSENT at the source, so the EXISTING "no intent recorded"
    // degrade fires — no new string, UI/freeze inherit (R7). Any authored line
    // in the block keeps the section verbatim (byte-identity carve).
    const currentSpec = inputs.nodeFileName === "SPEC.md" ? inputs.readme : null;
    const legacyReadme = inputs.nodeFileName === "SPEC.md" ? null : inputs.readme;
    const intentTextRaw = extractSection(inputs.readme, "Intent");
    const intentText = intentTextRaw !== null && !isPlaceholderOnlyBlock(intentTextRaw) ? intentTextRaw : null;
    const intentMedia = sectionMedia(intentText, escaping);
    // PM dogfood #1 — the per-section SELECTED sources (authored PRD canonical;
    // a pristine scaffold-only PRD section yields to an authored README
    // section). ONE selected parse per section drives BOTH the render and the
    // phase signal below (the single-parse pin, AR-2/S5, preserved).
    const miniSel = extractMiniReqsSelected(inputs.prd, legacyReadme, currentSpec);
    const miniReqs = miniSel.body;
    const planMedia = dedupMedia([
        ...sectionMedia(miniReqs, escaping),
        ...inputs.lockedArtifacts
            .map((a) => (mediaKind(a.path) ? toReviewMedia(a.path, "") : null))
            .filter((m) => m !== null),
    ]);
    const promised = extractProofContractSelected(inputs.prd, legacyReadme, currentSpec).items;
    const delivered = composeDelivered(promised, inputs.artifacts, inputs.readiness);
    delivered.escapingRefs.forEach((r) => escaping.add(r));
    const claimedPass = proofClaimsPass(inputs.proofMd);
    const anyRecordedVerdict = gateCells.some((c) => c.state !== "missing");
    const evidencePresent = inputs.artifacts.length > 0 || claimedPass;
    // release-0.4.7 intent-stage: `promised` is the POST-placeholder-filter
    // contract (extracted ONCE above from the SELECTED source, consumed by both
    // DELIVERED and this signal); `miniReqsIsAuthored` derives from the ONE
    // selected mini-reqs parse and also drives the PLAN concise render below
    // (the single-parse pin). PM dogfood #1: authored README sections riding
    // the selection count as authored structure — the render and the signal
    // move together, never apart.
    const miniReqsIsAuthored = hasAuthoredMiniReqs(miniReqs);
    const phase = derivePhase({
        prdAuthored: (currentSpec !== null || inputs.prd !== null) && (promised.length > 0 || miniReqsIsAuthored),
        realProofArtifactsPresent: inputs.artifacts.length > 0,
        activeQitemPresent: inputs.activeQitemPresent,
        verdictOrEvidenceSetPresent: anyRecordedVerdict || claimedPass,
        specLocked: planLock !== null,
        approved: deliveredLock !== null,
    });
    // Regime 2: evidence present, NO recorded passing state -> confirm-faithful.
    const recordedGreen = computeRecordedGreen(gateCells, inputs.artifacts, candidateSha);
    const confirmFaithful = [];
    if (!inputs.readiness?.configured && !recordedGreen.green && evidencePresent && claimedPass) {
        confirmFaithful.push({
            source: "agent",
            identity: `${slice.name}|confirm-faithful|${candidateSha ?? "no-sha"}`,
            summary: "confirm this proof is faithful",
            leg: "confirm-faithful",
            where: sliceRef,
            ageIso: null,
            priority: "high",
            tier: null,
            evidenceRef: "PROOF.md",
            unblocks: `${slice.name} green (regime 2)`,
            qitemId: null,
            destinationSession: null,
            derived: null,
        });
    }
    const latestArtifactIso = inputs.artifacts.reduce((acc, a) => (acc === null || a.droppedAt > acc ? a.droppedAt : acc), null);
    const derived = deriveExceptions(inputs.agents, inputs.attention, { promisedCount: promised.length, missingCount: delivered.missingCount }, sliceRef, nowIso, latestArtifactIso, inputs.approval.delivery?.at ?? null);
    const workflowDerived = deriveWorkflowExceptions(inputs.workflows ?? [], sliceRef, nowIso);
    const needsYou = composeNeedsYou(inputs.attention, [...derived, ...workflowDerived], confirmFaithful, "queue+artifacts", nowIso);
    const agents = composeAgentsBand(inputs.agents, `slice:${slice.name}`, derived, nowIso);
    // FR-5: an out-of-slice media ref = a defect finding, never a silent
    // no-render. Absolute paths AND ../ traversal segments both escape the
    // co-located contract (rev1 fixback at d6135921 — slice-19 containment class).
    const defects = [
        ...inputs.mediaRefs
            .filter((r) => r.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(r))
            .map((r) => r.startsWith("/")
            ? `absolute media path (must be slice-relative): ${r}`
            : `media ref escapes the slice dir (must be co-located): ${r}`),
        ...[...escaping]
            .sort()
            .map((r) => r.startsWith("/")
            ? `absolute media path (must be slice-relative): ${r}`
            : `media ref escapes the slice dir (must be co-located): ${r}`),
    ];
    return {
        slice: slice.name,
        sliceId: slice.id,
        title: slice.title,
        missionId: slice.missionId,
        phase,
        laneLabel: PHASE_LANE_LABELS[phase],
        intent: {
            text: intentText,
            media: intentMedia,
            ssotPath: inputs.readme !== null ? `${sliceRef}/${inputs.nodeFileName ?? "README.md"}` : null,
            degrade: intentText === null ? "no intent recorded" : null,
        },
        plan: {
            // release-0.4.7 intent-stage (S5 fold-in): a mini-reqs section with no
            // authored numbered item (placeholder-only or prose-only, per arch AR-2)
            // renders as ABSENT so the existing "— not planned yet" degrade fires —
            // same boolean as the phase signal (the single-parse pin).
            concise: { text: miniReqsIsAuthored ? miniReqs : null, media: planMedia },
            lockedArtifacts: inputs.lockedArtifacts,
            lock: planLock,
            // PM dogfood #1 — the ssot pointer follows the SELECTED mini-reqs
            // source (README when its authored section won over a pristine PRD
            // section); absent-source behavior unchanged.
            ssotPath: currentSpec !== null
                ? `${sliceRef}/SPEC.md`
                : miniSel.fromReadme
                    ? `${sliceRef}/README.md`
                    : inputs.prd !== null ? `${sliceRef}/IMPLEMENTATION-PRD.md` : null,
        },
        delivered: {
            items: delivered.items,
            extraProof: delivered.extraProof,
            lock: deliveredLock,
            proofDirPath: inputs.proofDirExists ? `${sliceRef}/proof` : null,
        },
        needsYou,
        agents,
        lineage,
        defects,
        ...(inputs.readiness ? { readiness: inputs.readiness } : {}),
        composedAt: nowIso,
    };
}
export function composeMissionReview(inputs) {
    const { nowIso } = inputs;
    const board = inputs.slices.map(({ review: s, green }) => {
        let stageCell;
        switch (s.phase) {
            case "spec":
                stageCell = s.plan.lock ? `spec-approved ${s.plan.lock.at}` : "spec unstamped";
                break;
            case "building":
                stageCell =
                    s.delivered.items.length > 0
                        ? `${s.delivered.items.filter((it) => it.verified !== "missing").length}/${s.delivered.items.length} proofs`
                        : "building";
                break;
            case "review":
                stageCell = `${green ? "GREEN" : "not green"} · ${s.lineage.mergeSha ?? "UNMERGED"}`;
                break;
            case "locked":
                stageCell = `stamped ${s.delivered.lock?.at ?? "?"}`;
                break;
            default:
                stageCell = "intent";
        }
        if (s.readiness?.configured)
            stageCell = `proof ${s.readiness.state} · ${s.readiness.revision.slice(0, 12)}`;
        const changedSinceStamp = s.needsYou.items.some((i) => i.derived?.kind === "stale-after-change");
        return {
            slice: s.slice,
            title: s.title,
            phase: s.phase,
            laneLabel: s.laneLabel,
            agentsCount: s.agents.rows.length,
            stageCell,
            changedSinceStamp,
            attentionWorthy: s.needsYou.items.length > 0 || changedSinceStamp,
        };
    });
    // The completion ledger — a query over the mission's slice set, never an
    // authored list (omission-proof by construction).
    const ledger = inputs.slices.map(({ review: s, green }) => ({
        slice: s.slice,
        candidateSha: s.lineage.candidateSha,
        gateCells: s.lineage.gateCells,
        mergeSha: s.lineage.mergeSha,
        needsHumanCount: s.needsYou.items.length,
        green: s.readiness?.configured ? s.readiness.state === "ready" : green,
    }));
    // Cut-complete: TRUE only when EVERY in-cut slice is (a) green, (b) merged,
    // (c) zero open needs-human items — never asserted from a status field.
    const incomplete = ledger.filter((r) => !(r.green && r.mergeSha !== null && r.needsHumanCount === 0));
    const cutComplete = ledger.length > 0 && incomplete.length === 0;
    // Mission NEEDS YOU = the union query (slice ∪ mission ∪ ▲), distinct
    // identities — an item at N altitudes is one item seen from N heights.
    const seen = new Set();
    const unionItems = [];
    for (const { review: s } of inputs.slices) {
        for (const i of s.needsYou.items) {
            if (!seen.has(i.identity)) {
                seen.add(i.identity);
                unionItems.push(i);
            }
        }
    }
    const missionBand = composeNeedsYou(inputs.missionAttention, [], [], "mission queue+slice unions", nowIso);
    for (const i of missionBand.items) {
        if (!seen.has(i.identity)) {
            seen.add(i.identity);
            unionItems.push(i);
        }
    }
    const agents = composeAgentsBand(inputs.agents, `mission:${inputs.mission.name}`, [], nowIso);
    const composed = {
        ...(inputs.readiness ? { readiness: inputs.readiness } : {}),
        mission: inputs.mission.name,
        missionId: inputs.mission.id,
        title: inputs.mission.title,
        intent: inputs.mission.intent ?? null,
        briefSpine: { building: "", progress: "", proven: "", needsYou: "" },
        board,
        ledger,
        cutComplete,
        cutCompleteBasis: (inputs.slices.some(s => s.review.readiness?.configured) ? "Proof readiness plus historical merge/attention facts; distinct outcome/publication decisions remain separate. " : "") + (cutComplete
            ? `all ${ledger.length} in-cut slices green + merged + zero needs-human · computed at ${nowIso}`
            : `${incomplete.length} of ${ledger.length} slices not cut-complete (${incomplete.map((r) => r.slice).join(", ") || "none"}) · computed at ${nowIso}`),
        needsYou: {
            items: unionItems,
            provenance: unionItems.length === 0
                ? `0 attention items across ${inputs.slices.length} slices — computed from queue+artifacts at ${nowIso}`
                : `union of ${inputs.slices.length} slice scopes + mission scope · computed at ${nowIso}`,
        },
        agents,
        composedAt: nowIso,
    };
    composed.briefSpine = renderBriefSpine(composed);
    return composed;
}
//# sourceMappingURL=compose.js.map