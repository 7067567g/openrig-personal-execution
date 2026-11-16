// KI-5.3-2 — the ONE logical-checkbox item grammar: parse an authored
// `## Proof contract` (or acceptance) checkbox block into logical items.
//
// PARITY CONTRACT (arch ruling 2026-07-11 twin-plus-parity, extended KI-5.3-2):
// this file is a BYTE-EQUIVALENT TWIN — it exists identically at
//   packages/cli/src/lib/scope/logical-checkbox.ts
//   packages/daemon/src/domain/scope/logical-checkbox.ts
// and byte-equivalence is CI-enforced by scope-audit-parity CLASSIFIER_FILES.
// Do NOT diverge the copies, and do NOT "deduplicate" them into one file — a
// true shared module importable by both packages does not exist in this layout,
// so the twin-plus-parity arrangement IS the single-grammar guarantee. The
// review composer, the slice-detail acceptance projector, and the CLI
// `rig proof add` evidence-index validator ALL parse through this one grammar,
// so a 1-based byIndex evidence ref names the SAME promised item on every side
// (no silent one-position mispair). If the layout ever gains a real shared
// package, the twins collapse into it then — not before.
const CHECKBOX_LINE = /^(\s*)-?\s*\[(\s|x|X)\]\s+(.+)$/;
/** Parse an authored checkbox block into logical items.
 *
 *  Continuation eligibility (pinned by test): a line is a continuation of the
 *  preceding checkbox when it is NONBLANK, NOT itself a checkbox, and its
 *  indentation is STRICTLY DEEPER than the checkbox line's. A next checkbox, a
 *  blank line, or same/shallower prose terminates the item. */
export function parseLogicalCheckboxes(block) {
    if (!block)
        return [];
    const lines = block.split(/\r?\n/);
    const out = [];
    let current = null;
    const flush = () => {
        if (!current)
            return;
        out.push({ checked: current.checked, rawText: current.parts.join(" ").trim(), sourceLine: current.sourceLine });
        current = null;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = line.match(CHECKBOX_LINE);
        if (m) {
            flush();
            current = {
                checked: m[2].toLowerCase() === "x",
                parts: [m[3].trim()],
                indent: m[1].length,
                sourceLine: i + 1,
            };
            continue;
        }
        if (!current)
            continue;
        if (line.trim().length === 0) {
            flush();
            continue;
        }
        const indent = line.length - line.trimStart().length;
        if (indent > current.indent) {
            current.parts.push(line.trim());
            continue;
        }
        flush();
    }
    flush();
    return out;
}
//# sourceMappingURL=logical-checkbox.js.map