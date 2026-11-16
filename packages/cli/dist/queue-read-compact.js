/**
 * Slice 15 (OPR.0.7.0.15) P2 and P3 — the compact status reads `rig queue show` and
 * `rig queue transitions` print when the `output.compact` switch is on and `--full` was not given.
 * CLI-side projections of the daemon's response: routes are untouched, and with the switch off (the
 * default) or with `--full` both commands print today's output byte for byte.
 */
/** Kept at today's key and path even when null, so filters such as `.blockedOn == null` or
 *  `.priority == "routine"` read as they do today. Every other field appears only with a value. */
const SHOW_ALWAYS = new Set([
    "qitemId", "state", "destinationSession", "sourceSession", "summary", "priority", "tags", "tsCreated", "tsUpdated",
    "pickup", "waiting", "blockedOn", "closureReason", "body", "bodyBytes", "bodyTruncated", "readView",
]);
function isEmpty(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === "string")
        return value.trim() === "";
    if (Array.isArray(value))
        return value.length === 0;
    if (typeof value === "object")
        return Object.keys(value).length === 0;
    return false;
}
/** P2: today's `show` preview without its empty fields. They are counted as one `readView.omittedFields`
 *  entry (so `readView.complete` turns false); naming each would cost more than the nulls it replaces.
 *  The full read is unchanged. */
export function compactShow(preview) {
    const item = {};
    const emptyOmitted = [];
    for (const [key, value] of Object.entries(preview)) {
        if (!SHOW_ALWAYS.has(key) && isEmpty(value))
            emptyOmitted.push(key);
        else
            item[key] = value;
    }
    const view = preview["readView"];
    if (view && emptyOmitted.length > 0) {
        item["readView"] = {
            ...view,
            complete: false,
            omittedFields: [...(view.omittedFields ?? []), { path: "empty fields", items: emptyOmitted.length }],
        };
    }
    return { item, emptyOmitted };
}
export function showEmptyNotice(emptyOmitted, fullCommand) {
    return `… ${emptyOmitted.length} empty field${emptyOmitted.length === 1 ? "" : "s"} not shown; full record: ${fullCommand}`;
}
/** How many of the latest transitions the compact log shows. */
export const TRANSITIONS_SHOWN = 5;
/**
 * P3: the latest transitions, in today's oldest-first order (so `.[-1]` is still the latest), always
 * including the transition that set the current disposition (its state change or closure, with its
 * note), even when later note-only updates push it past the tail. `earlier` counts what is left out.
 */
export function compactTransitions(log, shown = TRANSITIONS_SHOWN) {
    if (log.length <= shown)
        return { transitions: log, earlier: 0 };
    let disposition = -1;
    for (let i = log.length - 1; i >= 0; i -= 1) {
        const previous = i > 0 ? log[i - 1] : undefined;
        if (!previous || log[i]["state"] !== previous["state"] || !isEmpty(log[i]["closureReason"])) {
            disposition = i;
            break;
        }
    }
    const tailStart = log.length - shown;
    const kept = disposition >= 0 && disposition < tailStart ? [log[disposition], ...log.slice(tailStart + 1)] : log.slice(tailStart);
    return { transitions: kept, earlier: log.length - kept.length };
}
export function transitionsNotice(earlier, total, fullCommand) {
    return `${earlier} earlier transition${earlier === 1 ? "" : "s"} not shown (${total} in all; the latest disposition is kept); full log: ${fullCommand}`;
}
//# sourceMappingURL=queue-read-compact.js.map