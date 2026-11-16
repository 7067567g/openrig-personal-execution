import * as fs from "node:fs";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import YAML from "yaml";
import { parseAddress, resolveAddress } from "../markdown-address.js";
import { extractProofContractSelected, parseLogicalCheckboxes, proofItemIdentity } from "../review/compose.js";
import { validateMissionComposition } from "../lifecycle-manifest.js";
import { resolveNodeFileVia } from "../scope/node-file.js";
import { parseFrontmatter } from "../slices/slice-indexer.js";
export class JudgmentError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const proofFs = {
    exists: fs.existsSync,
    readFile: p => { try {
        return fs.readFileSync(p, "utf8");
    }
    catch (e) {
        if (e.code === "ENOENT")
            return null;
        throw e;
    } },
    readBytes: p => { try {
        return fs.readFileSync(p);
    }
    catch (e) {
        if (e.code === "ENOENT")
            return null;
        throw e;
    } },
    listDir: p => fs.readdirSync(p),
    isDirectory: p => fs.statSync(p).isDirectory(),
};
function mapping(value, source) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new JudgmentError("invalid_record", `${source}: expected a mapping`);
    return value;
}
function manifest(io, file) {
    const text = io.readFile(file);
    return text === null ? null : mapping(YAML.parse(text), file);
}
function workspaceOf(dir, io, required = true) {
    for (let p = path.resolve(dir);; p = path.dirname(p)) {
        if (io.exists(path.join(p, "project.yaml")))
            return p;
        if (path.dirname(p) === p) {
            if (!required)
                return path.resolve(dir);
            throw new JudgmentError("project_missing", "Locate project.yaml before recording a judgment");
        }
    }
}
/** The owning authored project, shared by readiness and lifecycle compilation.
 * Mission storage need not be the default one-level `missions` directory. */
export function resolveProjectRoot(dir) {
    return workspaceOf(dir, proofFs);
}
function policyOf(dir, io, readManifest = manifest, rootOverride) {
    // A selected catalog project bounds the search at its own root: an ancestor's project.yaml is another project.
    const root = rootOverride ?? workspaceOf(dir, io, false);
    for (let p = path.resolve(dir);; p = path.dirname(p)) {
        for (const name of ["slice.yaml", "mission.yaml", "project.yaml"]) {
            const file = path.join(p, name), doc = readManifest(io, file);
            if (doc && Object.hasOwn(doc, "proofPolicy")) {
                const policy = mapping(doc.proofPolicy, `${file}: proofPolicy`);
                if (Object.keys(policy).some(k => k !== "judges"))
                    throw new JudgmentError("policy_invalid", `${file}: proofPolicy supports judges only`);
                if (!Array.isArray(policy.judges) || !policy.judges.length || policy.judges.some(x => typeof x !== "string" || !x.trim()))
                    throw new JudgmentError("policy_invalid", `${file}: proofPolicy.judges must name authorized actors`);
                const judges = [...new Set(policy.judges)].sort();
                return { judges, source: file, revision: hash(judges) };
            }
        }
        if (p === root)
            return null;
    }
}
/** The uncached policy reader, with the optional project-root boundary. */
const defaultPolicyRead = (dir, io, root) => policyOf(dir, io, manifest, root);
/** One synchronous read composition owns this reader, then discards it. Only
 * policy manifest inputs (including absence) are reused, by absolute path and
 * exact I/O provider. Never retain across requests or pass through a mutation.
 * Parsed objects stay private; policyOf returns fresh policy/judges each time.
 * Errors still throw with their original source. This is not an atomic snapshot. */
export function createProofPolicyRead() {
    const inputs = new WeakMap();
    return (dir, io, root) => policyOf(dir, io, (provider, file) => {
        let files = inputs.get(provider);
        if (!files) {
            files = new Map();
            inputs.set(provider, files);
        }
        if (!files.has(file))
            files.set(file, manifest(provider, file));
        return files.get(file);
    }, root);
}
export function readProofContract(dir, io) {
    const files = { prd: "IMPLEMENTATION-PRD.md", readme: "README.md", spec: "SPEC.md" };
    const contents = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, io.readFile(path.join(dir, file))]));
    const selected = extractProofContractSelected(contents.prd ?? null, contents.readme ?? null, contents.spec ?? null);
    if (!selected.source || !selected.items.length)
        return [];
    const file = files[selected.source], section = resolveAddress(contents[selected.source], ["proof-contract"]);
    const logical = parseLogicalCheckboxes(section.text);
    return selected.items.map((item, index) => {
        const line = section.headerLine + (logical.find(row => row.rawText === item.rawText)?.sourceLine ?? 1);
        return { ...proofItemIdentity(item.rawText), index: index + 1, source: { file, line } };
    });
}
function ledger(dir, io) {
    const home = path.join(dir, "proof", "judgments");
    if (!io.exists(home))
        return [];
    const names = io.listDir(home).filter(f => !f.startsWith(".")).sort();
    const receipts = [];
    for (const name of names) {
        const expected = `${String(receipts.length + 1).padStart(8, "0")}.md`;
        if (name !== expected)
            throw new JudgmentError("journal_conflict", `${home}: expected ${expected}, found ${name}; inspect retained receipts`);
        const raw = io.readFile(path.join(home, name));
        const fm = raw && /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(raw);
        if (!fm)
            throw new JudgmentError("journal_invalid", `${home}/${name}: incomplete judgment`);
        const obj = mapping(YAML.parse(fm[1]), name), { id, ...payload } = obj;
        if (id !== hash(payload) || obj.version !== 1 || obj.sequence !== receipts.length + 1 || typeof obj.itemId !== "string" || typeof obj.itemRevision !== "string" || typeof obj.policyRevision !== "string" || typeof obj.actor !== "string" || typeof obj.operationId !== "string" || typeof obj.intent !== "string" || !["accept", "reject", "withdraw"].includes(String(obj.verdict)) || !Array.isArray(obj.evidence))
            throw new JudgmentError("journal_invalid", `${home}/${name}: malformed or changed judgment; inspect history`);
        const subject = mapping(obj.subject, name);
        if ([obj.scope, obj.itemId, obj.itemRevision, obj.policyRevision, obj.policySource, obj.actor, obj.operationId, obj.intent, obj.reason, obj.provenance, obj.at].some(v => typeof v !== "string" || !v.trim()) || !Number.isFinite(Date.parse(String(obj.at))) || !["artifact", "commit", "patch-equivalent"].includes(String(subject.kind)) || typeof subject.ref !== "string" || !subject.ref.trim() || (subject.comparison !== undefined && typeof subject.comparison !== "string") || obj.evidence.some(e => !e || typeof e !== "object" || typeof e.ref !== "string" || !e.ref || typeof e.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(e.sha256)))
            throw new JudgmentError("journal_invalid", `${home}/${name}: malformed judgment fields`);
        if (receipts.some(r => r.operationId === obj.operationId))
            throw new JudgmentError("journal_conflict", `${home}/${name}: repeated operation identity`);
        const prior = receipts.filter(r => r.itemId === obj.itemId).at(-1);
        if (obj.previous !== (prior?.id ?? null))
            throw new JudgmentError("journal_conflict", `${home}/${name}: conflicting correction lineage`);
        receipts.push(obj);
    }
    return receipts;
}
function contained(root, target) {
    const base = fs.realpathSync(root), requested = path.resolve(root, target);
    // Resolve the nearest existing ancestor so platform aliases and symlink parents
    // are judged at the real boundary, including a not-yet-created receipt leaf.
    let existing = requested;
    while (!fs.existsSync(existing))
        existing = path.dirname(existing);
    const full = path.resolve(fs.realpathSync(existing), path.relative(existing, requested));
    if (full !== base && !full.startsWith(base + path.sep))
        throw new JudgmentError("path_escape", `Path escapes ${base}; paths must stay within the selected workspace`);
    return full;
}
export function evidenceAt(root, dir, ref) {
    if (!ref || typeof ref !== "string")
        throw new JudgmentError("evidence_required", "Reference readable evidence under the project workspace");
    const { ref: file, headerPath } = parseAddress(ref);
    const fragment = headerPath.join("/");
    const target = contained(root, path.isAbsolute(file) ? file : file.startsWith("missions/") ? file : path.resolve(dir, file));
    if (!fs.existsSync(target) || !fs.statSync(target).isFile())
        throw new JudgmentError("evidence_missing", `Evidence is unavailable: ${ref}`);
    const bytes = fs.readFileSync(target);
    let addressed = bytes;
    if (headerPath.length) {
        try {
            addressed = resolveAddress(bytes.toString("utf8"), headerPath).text;
        }
        catch (e) {
            throw new JudgmentError("evidence_address", e.message);
        }
    }
    return { ref: path.relative(fs.realpathSync(root), target).split(path.sep).join("/") + (fragment ? `#${fragment}` : ""), sha256: createHash("sha256").update(addressed).digest("hex") };
}
/** `root` (a selected catalog project's root) bounds the policy search and the scope identity; without it they derive
 *  from the nearest project.yaml, as for the selected workspace. */
export function readSliceReadiness(dir, io = proofFs, readPolicy = defaultPolicyRead, root) {
    let policy = null, receipts = [], items = [];
    const issues = [];
    let policyRead = false;
    try {
        policy = readPolicy(dir, io, root);
        policyRead = true;
        receipts = ledger(dir, io);
        const scopeRoot = root ?? workspaceOf(dir, io, false), promises = readProofContract(dir, io);
        if (new Set(promises.map(p => p.id)).size !== promises.length)
            throw new JudgmentError("item_ambiguous", "Repeated item identity; give distinct promises explicit <!-- proof-item: id --> markers");
        items = promises.map(p => {
            const scope = path.relative(scopeRoot, dir).split(path.sep).join("/");
            const revision = hash([scope, p.id, p.text, policy?.revision ?? null]);
            const judgment = receipts.filter(r => r.itemId === p.id).at(-1) ?? null;
            let state = "pending", reason = "No current attributed judgment";
            if (judgment) {
                if (!policy || judgment.scope !== scope || judgment.itemRevision !== revision || judgment.policyRevision !== policy.revision) {
                    state = "unknown";
                    reason = "Scope, item or policy changed; record a judgment on the current revision";
                }
                else if (judgment.verdict !== "accept") {
                    state = judgment.verdict === "reject" ? "rejected" : "withdrawn";
                    reason = judgment.reason;
                }
                else if (!policy.judges.includes(judgment.actor)) {
                    state = "unknown";
                    reason = "Judgment actor is outside the selected policy";
                }
                else {
                    const valid = judgment.evidence.length > 0 && judgment.evidence.every(e => {
                        if (!e || typeof e.ref !== "string" || typeof e.sha256 !== "string")
                            return false;
                        try {
                            const address = parseAddress(e.ref), file = path.resolve(scopeRoot, address.ref);
                            if (io.readBytes)
                                contained(scopeRoot, file);
                            const bytes = io.readBytes ? io.readBytes(file) : io.readFile(file);
                            if (bytes === null)
                                return false;
                            const addressed = address.headerPath.length ? resolveAddress(typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("utf8"), address.headerPath).text : bytes;
                            return createHash("sha256").update(addressed).digest("hex") === e.sha256;
                        }
                        catch {
                            return false;
                        }
                    });
                    state = valid ? "accepted" : "unknown";
                    reason = valid ? judgment.reason : "Evidence missing or changed; inspect the retained judgment";
                }
            }
            return { ...p, revision, state, reason, judgment };
        });
        if (policy && !items.length)
            issues.push("No authored proof contract");
    }
    catch (e) {
        issues.push(e instanceof Error ? e.message : String(e));
    }
    const configured = policy !== null || io.exists(path.join(dir, "proof", "judgments")) || (!policyRead && issues.length > 0);
    const state = issues.length ? "unknown" : !configured ? "legacy" : items.some(i => i.state === "unknown") ? "unknown" : items.length && items.every(i => i.state === "accepted") ? "ready" : "not-ready";
    const revision = hash([policy?.revision, items, issues]);
    const history = receipts.map(r => ({ ref: `${r.scope}/proof/judgments/${String(r.sequence).padStart(8, "0")}.md`, id: r.id, itemId: r.itemId, verdict: r.verdict, previous: r.previous }));
    return { configured, revision, state, history, items, issues, policy, attention: { scope: dir, revision } };
}
export function resolveProofScope(root, scope) {
    const dir = contained(root, scope);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
        throw new JudgmentError("scope_missing", "Select an existing mission or slice directory", 404);
    return dir;
}
/**
 * Records a verifiable proof judgment for a slice item into the judgments ledger.
 *
 * @param missionsRoot - Workspace root path for resolving scopes.
 * @param input - Judgment details including scope, item, verdict, and evidence.
 * @param actor - Identifier of the judging actor authorized under the proof policy.
 * @param provenance - Attestation provenance string recorded in the ledger.
 * @returns Recorded judgment receipt, current slice readiness, and replay status.
 */
/** `projectRoot` (the selected catalog project's root) is the boundary for evidence containment, the policy search and
 *  the recorded scope identity. Without it the nearest project.yaml is used, which for a catalog project without its own
 *  manifest would be an ANCESTOR, i.e. another project (CWE-22). */
export function recordJudgment(missionsRoot, input, actor, provenance, projectRoot) {
    const dir = resolveProofScope(missionsRoot, input.scope), root = projectRoot ? contained(projectRoot, dir) && path.resolve(projectRoot) : workspaceOf(dir, proofFs);
    if (path.basename(path.dirname(dir)) !== "slices")
        throw new JudgmentError("slice_required", "Item judgments belong to a slice; higher outcome judgments remain workflow decisions");
    if (!fs.statSync(dir).isDirectory())
        throw new JudgmentError("scope_missing", "Select a slice directory");
    const current = readSliceReadiness(dir, proofFs, defaultPolicyRead, projectRoot);
    if (!current.policy)
        throw new JudgmentError("policy_required", "Author proofPolicy.judges at the slice, mission or project before judging");
    if (!current.policy.judges.includes(actor))
        throw new JudgmentError("actor_not_authorized", `${actor} is not a judge under ${current.policy.source}`, 403);
    if (current.issues.length)
        throw new JudgmentError("readiness_unavailable", current.issues.join("; "), 409);
    const item = current.items.find(i => i.id === input.item || String(i.index) === input.item || i.text === input.item);
    if (!item)
        throw new JudgmentError("item_missing", "Select one current item from rig proof show");
    if (!["accept", "reject", "withdraw"].includes(input.verdict) || !input.reason?.trim())
        throw new JudgmentError("judgment_invalid", "Provide accept, reject or withdraw and the reason for that judgment");
    const evidence = input.evidence?.map(ref => evidenceAt(root, dir, ref)) ?? (input.verdict !== "accept" ? item.judgment?.evidence ?? [] : []);
    if (input.verdict === "accept" && !evidence.length)
        throw new JudgmentError("evidence_required", "Acceptance requires readable evidence; capture alone and queue done are not acceptance");
    let subject = input.subject ?? item.judgment?.subject ?? { kind: "artifact", ref: evidence[0]?.ref ?? item.id };
    if (!["artifact", "commit", "patch-equivalent"].includes(subject.kind) || !subject.ref?.trim())
        throw new JudgmentError("subject_invalid", "Name an artifact, commit or patch-equivalent subject");
    if (subject.kind === "patch-equivalent" && input.verdict === "accept") {
        if (!subject.comparison)
            throw new JudgmentError("comparison_required", "Patch equivalence requires --comparison pointing to the actual comparison/adoption receipt, in addition to outcome evidence");
        const comparison = evidenceAt(root, dir, subject.comparison);
        if (!evidence.some(e => e.ref !== comparison.ref))
            throw new JudgmentError("comparison_required", "Reference distinct outcome evidence and a comparison/adoption receipt");
        if (!evidence.some(e => e.ref === comparison.ref))
            evidence.push(comparison);
        subject = { ...subject, comparison: comparison.ref };
    }
    if (input.expectedEvidence && hash(input.expectedEvidence) !== hash(evidence))
        throw new JudgmentError("evidence_conflict", "Evidence changed since preparation; inspect current bytes before judging", 409);
    const receipts = ledger(dir, proofFs);
    const intent = hash([item.id, input.expectedRevision, actor, input.verdict, input.reason, evidence, subject]);
    const operationId = input.operationId ?? hash([intent, input.replace ? input.expectedPrevious : null]);
    const priorOperation = receipts.find(r => r.operationId === operationId);
    if (priorOperation) {
        if (priorOperation.intent !== intent)
            throw new JudgmentError("operation_conflict", "Operation identity already records different contents", 409);
        return { judgment: priorOperation, readiness: readSliceReadiness(dir, proofFs, defaultPolicyRead, projectRoot), replayed: true };
    }
    const latest = receipts.filter(r => r.itemId === item.id).at(-1);
    if (input.expectedRevision !== item.revision || input.expectedPrevious !== (latest?.id ?? null))
        throw new JudgmentError("revision_conflict", "Item or correction changed; inspect rig proof show and judge the current evidence", 409);
    const payload = { version: 1, scope: path.relative(root, dir).split(path.sep).join("/"), sequence: receipts.length + 1, operationId, itemId: item.id, itemRevision: item.revision, policyRevision: current.policy.revision, policySource: path.relative(root, current.policy.source), previous: latest?.id ?? null, actor, provenance, at: new Date().toISOString(), verdict: input.verdict, reason: input.reason, evidence, subject, intent };
    const judgment = { ...payload, id: hash(payload) };
    const home = contained(root, path.join(dir, "proof", "judgments"));
    fs.mkdirSync(home, { recursive: true });
    const temporary = path.join(home, `.write-${randomUUID()}`), target = path.join(home, `${String(payload.sequence).padStart(8, "0")}.md`);
    // Same-directory temp+fsync follows FileWriteService; link publishes without replacing a receipt.
    // Synchronous in the supported daemon writer. A competing process loses the exclusive publication.
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
        try {
            fs.writeFileSync(fd, `---\n${YAML.stringify(judgment)}---\n\n${input.reason}\n`);
            fs.fsyncSync(fd);
        }
        finally {
            fs.closeSync(fd);
        }
        fs.linkSync(temporary, target);
        const directory = fs.openSync(home, "r");
        try {
            fs.fsyncSync(directory);
        }
        finally {
            fs.closeSync(directory);
        }
    }
    catch (e) {
        if (e.code === "EEXIST")
            throw new JudgmentError("revision_conflict", "Another writer committed first; inspect current readiness", 409);
        throw e;
    }
    finally {
        fs.unlinkSync(temporary);
    }
    return { judgment, readiness: readSliceReadiness(dir, proofFs, defaultPolicyRead, projectRoot), replayed: false };
}
/**
 * Evaluates readiness for a mission by reading its composition and resolving member slices.
 *
 * @param missionDir - Path to the mission directory containing mission.yaml.
 * @param readPolicy - Reader function for determining applicable proof policy.
 * @returns Evaluated mission readiness, including revision, state, slices, and any issues.
 */
export function readMissionReadiness(missionDir, readPolicy = defaultPolicyRead, root) {
    const issues = [], slices = [];
    // #1280: each member's directory, for reading its declared node identity only when a dependency needs it.
    const dirs = new Map();
    let historicalStatus = null;
    try {
        const doc = manifest(proofFs, path.join(missionDir, "mission.yaml"));
        if (!doc)
            return { revision: hash("legacy"), state: "legacy", slices, issues, historicalStatus };
        const metadata = doc.metadata != null ? mapping(doc.metadata, "mission metadata") : {};
        historicalStatus = typeof metadata.status === "string" ? metadata.status : null;
        const members = validateMissionComposition(doc, path.join(missionDir, "mission.yaml")).filter(m => m.active);
        for (const member of members) {
            const dir = path.dirname(member.path), data = manifest(proofFs, member.path);
            const execution = data?.execution;
            const depends = execution?.depends_on ?? [];
            if (!Array.isArray(depends) || depends.some(x => typeof x !== "string"))
                throw new JudgmentError("dependencies_invalid", `${member.path}: execution.depends_on must be a list`);
            const id = data?.metadata?.id ?? path.basename(dir);
            if (typeof id !== "string" || !id || slices.some(s => s.id === id))
                throw new JudgmentError("dependency_identity", `${member.path}: missing or repeated slice identity`);
            const slice = { scope: path.basename(dir), id, readiness: readSliceReadiness(dir, proofFs, readPolicy, root), dependsOn: depends, eligible: null };
            slices.push(slice);
            dirs.set(slice, dir);
        }
        // A dependency name resolves as it always has. Only a name that matches no member's identity may resolve by the SPEC id a
        // member declares (read the way the execution view reads it), and only when exactly one active member declares it;
        // anything else stays an unknown dependency.
        let declared = null;
        const resolve = (name) => {
            const exact = slices.find(x => x.id === name);
            if (exact)
                return exact;
            declared ??= new Map(slices.map(x => [x, declaredNodeId(dirs.get(x))]));
            const declaring = slices.filter(x => declared.get(x) === name);
            return declaring.length === 1 ? declaring[0] : undefined;
        };
        const memo = new Map();
        const visit = (s, visiting = new Set()) => {
            if (visiting.has(s.id))
                throw new JudgmentError("dependency_cycle", `Cycle involving ${s.scope}`);
            if (memo.has(s.id))
                return memo.get(s.id);
            const next = new Set(visiting).add(s.id);
            const dependencies = s.dependsOn.map(name => {
                const dep = resolve(name);
                if (!dep)
                    throw new JudgmentError("dependency_missing", `${s.scope}: unknown dependency ${name}`);
                const upstream = visit(dep, next);
                return upstream === null || ["unknown", "legacy"].includes(dep.readiness.state) ? null : upstream && dep.readiness.state === "ready";
            });
            const eligible = ["unknown", "legacy"].includes(s.readiness.state) || dependencies.includes(null) ? null : dependencies.every(Boolean);
            memo.set(s.id, eligible);
            return eligible;
        };
        for (const s of slices)
            s.eligible = visit(s);
    }
    catch (e) {
        issues.push(e instanceof Error ? e.message : String(e));
        for (const s of slices)
            s.eligible = null;
    }
    const state = issues.length || slices.some(s => ["unknown", "legacy"].includes(s.readiness.state)) ? "unknown" : slices.length && slices.every(s => s.readiness.state === "ready") ? "ready" : "not-ready";
    return { revision: hash([slices, issues, historicalStatus]), state, slices, issues, historicalStatus };
}
/** The `id:` a work node's authored file declares, or null when it declares none or can't be read. */
function declaredNodeId(dir) {
    try {
        const node = resolveNodeFileVia(dir, p => proofFs.readFile(p));
        const id = node ? parseFrontmatter(node.content)["id"] : undefined;
        return typeof id === "string" && id.length > 0 ? id : null;
    }
    catch {
        return null;
    }
}
export function readProjectReadiness(missionsRoot, readPolicy = defaultPolicyRead, root) {
    const missions = fs.readdirSync(missionsRoot).filter(n => fs.statSync(path.join(missionsRoot, n)).isDirectory()).map(name => ({ name, ...readMissionReadiness(contained(missionsRoot, path.join(missionsRoot, name)), readPolicy, root) }));
    const active = missions.filter(m => ["active", "release-candidate"].includes(m.historicalStatus ?? ""));
    return { revision: hash(active), state: active.length && active.every(m => m.state === "ready") ? "ready" : active.some(m => m.state === "unknown") ? "unknown" : "not-ready", missions, basis: "Active mission readiness; distinct outcome judgment and publication remain separate" };
}
//# sourceMappingURL=judgments.js.map