function line(segs) {
    return { text: segs.map((s) => s.text).join(""), segs };
}
/** Flatten per-seat failing checks into triage rows (green omitted); red before yellow. */
export function buildTriageModel(input) {
    const rows = [];
    for (const s of input) {
        for (const e of s.entries) {
            if (e.status === "green")
                continue;
            rows.push({
                seat: s.seat,
                check: e.check,
                status: e.status,
                need: e.remediation,
                evidence: e.evidence,
                remediationSafe: e.remediationSafe ?? false,
            });
        }
    }
    // Red (needs action) before yellow (caveat); JS sort is stable, so same-status order is preserved.
    return rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "red" ? -1 : 1));
}
/** Render the triage list: a header + one row per need (seat + remediation, the check dim), or the
 *  all-clean line when nothing needs attention. */
export function renderTriage(rows) {
    if (rows.length === 0) {
        return [line([{ text: " ✓ ", token: "ok" }, { text: "all seats restored clean" }])];
    }
    const out = [line([{ text: `NEEDS ATTENTION (${rows.length})`, token: "warn", bold: true }])];
    for (const r of rows) {
        const glyph = r.status === "red" ? "●" : "◌";
        const tok = r.status === "red" ? "error" : "warn";
        out.push(line([
            { text: ` ${glyph} `, token: tok },
            { text: r.seat, token: "bright", bold: true },
            { text: ` — ${r.need}` },
            { text: ` (${r.check})`, token: "dim" },
        ]));
    }
    return out;
}
//# sourceMappingURL=triage.js.map