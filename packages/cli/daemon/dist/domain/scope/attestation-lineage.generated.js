// GENERATED FILE — DO NOT EDIT.
// Emitted by scripts/sync-scope-lineage.mjs from the canonical source:
//   packages/cli/src/lib/scope/attestation-lineage.ts
// Edit the canonical file, then run: node scripts/sync-scope-lineage.mjs
// The scope-lineage-parity vitest pin fails if this mirror drifts.
export function attestationLineage(frontmatterRaw) {
    if (!frontmatterRaw)
        return undefined;
    const read = (key) => {
        const m = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m").exec(frontmatterRaw);
        return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
    };
    const lineage = {};
    for (const [scope, fields] of [
        ["spec", { by: "approved-spec-by", at: "approved-spec-at", priors: "approved-spec-priors" }],
        ["delivery", { by: "approved-by", at: "approved-at", priors: "approved-priors" }],
    ]) {
        const priorsRaw = read(fields.priors);
        const priors = priorsRaw !== null ? Number(priorsRaw) : NaN;
        if (Number.isFinite(priors) && priors > 0) {
            lineage[scope] = { by: read(fields.by) ?? "?", at: read(fields.at) ?? "?", priors };
        }
    }
    return Object.keys(lineage).length > 0 ? lineage : undefined;
}
//# sourceMappingURL=attestation-lineage.generated.js.map