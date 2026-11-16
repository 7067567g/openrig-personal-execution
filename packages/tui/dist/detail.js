/** Wrap prose and full references without losing a link's target. Graph/table rows
 * retain their own layout; callers opt in only for detail pages. */
export function wrapDetailLines(lines, width) {
    const room = Math.max(8, width);
    // A ContentLine is one logical terminal row. YAML block scalars and current
    // source files may contain CR/LF; never emit those inside a physical row.
    const logical = lines.flatMap((line) => line.text.split(/\r\n|\r|\n/).map((text, i) => ({
        ...line, text: text.replace(/\t/g, "    ").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, "0")}`),
        ...(i ? { action: undefined, zones: undefined, segs: undefined } : {}),
    })));
    return logical.flatMap((line) => {
        if (line.zones)
            return [line]; // tab hit zones retain the renderer's existing clipping rules
        if (line.text.startsWith("  ──") && line.text.replace(/─+$/, "").length <= room)
            return [{ ...line, text: line.text.slice(0, room) }];
        if (line.text.length <= room)
            return [line];
        const result = [];
        // Keep the source flat: prepending indent to the remaining suffix on every
        // row repeatedly flattens/copies a large unbroken file line.
        let offset = 0;
        let indent = "";
        while (line.text.length - offset + indent.length > room) {
            const chunk = indent + line.text.slice(offset, offset + room - indent.length + 1);
            const space = chunk.lastIndexOf(" ", room);
            let cut = space >= room / 2 ? space : room;
            // A hard wrap must keep a UTF-16 surrogate pair on the same row.
            const before = chunk.charCodeAt(cut - 1);
            const after = chunk.charCodeAt(cut);
            if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
                cut--;
            result.push({ text: chunk.slice(0, cut), ...(result.length === 0 && line.action ? { action: line.action } : {}) });
            offset += cut - indent.length;
            while (offset < line.text.length && /\s/.test(line.text[offset]))
                offset++;
            indent = "    ";
        }
        result.push({ text: indent + line.text.slice(offset) });
        return result;
    });
}
/** fixed label column — one rhythm across every detail page */
export const LABEL_W = 12;
const OPEN = "(open ▸)";
function pad(text, width) {
    return text.length >= width ? text : text + " ".repeat(width - text.length);
}
export function fieldLine(field) {
    const label = pad(`${field.label}:`, LABEL_W);
    const base = `  ${label} ${field.value}`;
    if (!field.link)
        return { text: base };
    return { text: `${base}  ${OPEN}`, action: field.link };
}
export function sectionRule(title, width = 96) {
    const head = `  ── ${title} `;
    return { text: head + "─".repeat(Math.max(width - head.length, 4)) };
}
export function listItem(text, link, indent = 2) {
    const base = `${" ".repeat(indent)}▪ ${text}`;
    if (!link)
        return { text: base };
    return { text: `${base}  ${OPEN}`, action: link };
}
/** Assemble a detail page: one spacing rhythm — a blank line before every
 * section rule except the first content block. */
export function detailPage(heading, sections) {
    const lines = [heading];
    for (const section of sections) {
        const body = [];
        for (const field of section.fields ?? [])
            body.push(fieldLine(field));
        body.push(...(section.lines ?? []));
        if (body.length === 0)
            continue;
        lines.push({ text: "" });
        if (section.title)
            lines.push(sectionRule(section.title));
        lines.push(...body);
    }
    return lines;
}
/** Aligned columns for list-style pages (needs-you, hosts-down): the glance
 * win is fixed columns, not dash-run-ons. */
export function alignedRow(cols, tail = "") {
    return cols.map(([text, width]) => pad(text, width)).join(" ") + tail;
}
//# sourceMappingURL=detail.js.map