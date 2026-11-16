// OPR.0.5.3.5 Atom 3 — the composition algebra (locked SPEC, founder refinement):
//
//   FRESH           = the base walk (atoms tagged fresh)
//   HANDOVER        = FRESH + the handover material (atoms tagged handover)
//   POST-COMPACTION = the tagged subset of fresh + the handover material
//
// Every profile is CLOSED over requires (a subset profile must close — intake rule);
// the runtime filter runs per mini-req 3 (claude and codex are never assumed to have
// lost the same dimensions, so they compose different profiles from the SAME graph);
// each piece resolves through the Atom-1 address machinery and carries a per-piece
// SOURCE LABEL (Q2-Amendment 1: composition is multi-source by contract — library /
// project tree / seat tree / mission tree — and every assembled piece names its source; the caller's
// resolver decides the kind, this module labels). Budgets are evaluated AT COMPOSE
// and on overage REPORT the amount and the priority-ordered drop candidates —
// composition never silently truncates (mini-req 9; D2: budgets flag for review,
// never silently govern).
//
// PURE by contract, like the manifest parser: file text arrives through the caller's
// readFile so the same algebra serves library packs today and configured tree roots
// (project/seat/mission sources) when the wiring atom lands. Every failure is LOUD and names
// the atom — a compose stops rather than thinning the walk (the Q1 rationale). One exception:
// a POST-COMPACTION compose skips a genuinely absent seat recap and reports it in `skipped`,
// because a compacted seat still has its own restore map and transcript. A handover successor
// has neither, so its missing recap still fails.
import { estimateTokensFromBytes } from "./token-estimate.js";
import { AddressResolutionError, parseAddress, resolveAddress } from "../markdown-address.js";
import { isSeatRecapAddress, SourceAbsentError } from "./profile-source-resolver.js";
export class ProfileComposeError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProfileComposeError";
    }
}
/** Which situation tags select atoms for a profile, per the locked algebra. */
function selectionTags(situation) {
    switch (situation) {
        case "fresh":
            return ["fresh"];
        case "handover":
            return ["fresh", "handover"];
        case "post-compaction":
            return ["post-compaction", "handover"];
    }
}
const DROP_ORDER = { optional: 0, recommended: 1, core: 2 };
function resolvePieces(input) {
    return input.atoms.flatMap((a) => {
        const { ref, headerPath } = parseAddress(a.address);
        let fileText;
        try {
            fileText = input.readFile(ref);
        }
        catch (err) {
            if (input.situation === "post-compaction" && err instanceof SourceAbsentError && isSeatRecapAddress(a.address)) {
                input.skipped.push({ atomId: a.id, address: a.address });
                return [];
            }
            throw new ProfileComposeError(`atom '${a.id}' (${a.address}): source file '${ref}' is unreadable — ${err.message}`);
        }
        let text;
        if (headerPath.length === 0) {
            text = fileText;
        }
        else {
            try {
                text = resolveAddress(fileText, headerPath).text;
            }
            catch (err) {
                if (err instanceof AddressResolutionError) {
                    throw new ProfileComposeError(`atom '${a.id}' (${a.address}): ${err.message}`);
                }
                throw err;
            }
        }
        return [{
                atomId: a.id,
                address: a.address,
                sourceKind: input.sourceKindFor?.(a) ?? "library",
                order: a.order,
                priority: a.priority,
                text,
                estimatedTokens: estimateTokensFromBytes(Buffer.byteLength(text, "utf-8")),
                ...(input.phaseId !== undefined ? { phaseId: input.phaseId } : {}),
            }];
    });
}
function budgetReport(pieces, budgetTokens) {
    const totalEstimatedTokens = pieces.reduce((sum, piece) => sum + piece.estimatedTokens, 0);
    if (budgetTokens === undefined || totalEstimatedTokens <= budgetTokens)
        return undefined;
    return {
        limitTokens: budgetTokens,
        overageTokens: totalEstimatedTokens - budgetTokens,
        dropCandidates: [...pieces]
            .sort((x, y) => DROP_ORDER[x.priority] - DROP_ORDER[y.priority] || y.estimatedTokens - x.estimatedTokens || x.atomId.localeCompare(y.atomId))
            .map((piece) => ({ atomId: piece.atomId, priority: piece.priority, estimatedTokens: piece.estimatedTokens })),
    };
}
export function composeProfile(input) {
    const { atoms, situation, runtime, readFile, budgetTokens, sourceKindFor } = input;
    const byId = new Map(atoms.map((a) => [a.id, a]));
    // 1. SELECT by situation tag, then filter by runtime (an "any" atom serves both).
    const tags = selectionTags(situation);
    const runtimeFits = (a) => a.runtime === "any" || a.runtime === runtime;
    const selected = new Map();
    for (const a of atoms) {
        if (!a.profileOnly && a.situations.some((s) => tags.includes(s)) && runtimeFits(a))
            selected.set(a.id, a);
    }
    // 2. CLOSE over requires: a required atom joins the profile even when untagged.
    //    A dependency that exists but is excluded by the RUNTIME filter is a broken
    //    graph for this runtime — fail loud, never a quietly thinner walk.
    const queue = [...selected.keys()];
    while (queue.length > 0) {
        const id = queue.pop();
        for (const req of selected.get(id)?.requires ?? byId.get(id)?.requires ?? []) {
            if (selected.has(req))
                continue;
            const dep = byId.get(req);
            if (!dep) {
                throw new ProfileComposeError(`atom '${id}' requires '${req}', which is not in the graph — the ${situation} profile cannot close.`);
            }
            if (!runtimeFits(dep)) {
                throw new ProfileComposeError(`atom '${id}' requires '${req}', but '${req}' is declared runtime=${dep.runtime} and this compose targets runtime=${runtime} — ` +
                    `the closure would silently thin the ${situation} walk; fix the graph (retag '${req}' or drop the edge).`);
            }
            selected.set(req, dep);
            queue.push(req);
        }
    }
    // 3. ORDER the walk (stable: order, then id — absorption depends on sequence).
    const walk = [...selected.values()].sort((x, y) => x.order - y.order || x.id.localeCompare(y.id));
    // 4. RESOLVE every piece through the one address machinery; label its source.
    const skipped = [];
    const pieces = resolvePieces({ atoms: walk, readFile, situation, skipped, sourceKindFor });
    const totalEstimatedTokens = pieces.reduce((sum, p) => sum + p.estimatedTokens, 0);
    // 5. BUDGET report (mini-req 9): flag, never govern — all pieces stay.
    const budget = budgetReport(pieces, budgetTokens);
    return {
        situation, runtime, pieces, totalEstimatedTokens,
        ...(skipped.length > 0 ? { skipped } : {}),
        ...(budget !== undefined ? { budget } : {}),
    };
}
/** Compose one explicit manifest profile. Profiles change only selection and
 * sequence: every atom still resolves through the same source graph, while
 * project/mission/seat/task atoms are supplied by the route from configured
 * roots. */
export function composeNamedProfile(input) {
    const { profile, atoms, situation, runtime, readFile, sourceKindFor, budgetTokens, contextAtoms } = input;
    if (!profile.situations.includes(situation)) {
        throw new ProfileComposeError(`profile '${profile.id}' does not apply to situation '${situation}'`);
    }
    if (!profile.runtimes.includes(runtime)) {
        throw new ProfileComposeError(`profile '${profile.id}' does not apply to runtime '${runtime}'`);
    }
    const atomsById = new Map(atoms.map((atom) => [atom.id, atom]));
    const skipped = [];
    const phases = profile.phases.map((phase) => {
        let selected;
        let kind;
        if (phase.atoms) {
            kind = "atoms";
            selected = phase.atoms.map((atomId) => {
                const atom = atomsById.get(atomId);
                if (!atom)
                    throw new ProfileComposeError(`profile '${profile.id}' phase '${phase.id}' references missing atom '${atomId}'`);
                return atom;
            });
        }
        else {
            kind = "context";
            selected = [];
            for (const source of phase.context ?? []) {
                const sourceAtoms = contextAtoms[source];
                if (!sourceAtoms || sourceAtoms.length === 0) {
                    throw new ProfileComposeError(`profile '${profile.id}' phase '${phase.id}' needs ${source} context, but the caller did not supply its exact selection`);
                }
                selected.push(...sourceAtoms);
            }
        }
        const pieces = resolvePieces({ atoms: selected, readFile, situation, skipped, sourceKindFor, phaseId: phase.id });
        return {
            id: phase.id,
            kind,
            ...(phase.context ? { sources: [...phase.context] } : {}),
            pieces,
            estimatedTokens: pieces.reduce((sum, piece) => sum + piece.estimatedTokens, 0),
        };
    });
    const pieces = phases.flatMap((phase) => phase.pieces);
    const totalEstimatedTokens = pieces.reduce((sum, piece) => sum + piece.estimatedTokens, 0);
    const budget = budgetReport(pieces, budgetTokens);
    return {
        situation,
        runtime,
        profileId: profile.id,
        phases,
        pieces,
        totalEstimatedTokens,
        ...(skipped.length > 0 ? { skipped } : {}),
        ...(budget !== undefined ? { budget } : {}),
    };
}
//# sourceMappingURL=profile-composer.js.map