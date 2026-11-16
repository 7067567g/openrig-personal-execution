/** qitem-render-driver B — the ONE logical-checkbox record, shared by every
 *  reader of an authored checkbox list (Review's proof contract, the
 *  slice-detail projector's acceptance rows, and the CLI proof-add index).
 *
 *  `rawText` is the COMPLETE logical item — a checkbox line plus any eligible
 *  indented continuation, joined with exactly one U+0020 — and it IS the
 *  VM-006 join key (textKey = trim + casefold over these bytes). Every reader
 *  MUST consume this record so promise, acceptance, dedup and the QA-verdict
 *  lift key off identical bytes by construction; a second parser would silently
 *  desynchronize the join. */
export interface LogicalCheckboxItem {
    /** The author's tick state (`- [x]`). */
    checked: boolean;
    /** The complete logical item text (continuations joined), trim-only. */
    rawText: string;
    /** 1-based line of the CHECKBOX itself — never a continuation line. */
    sourceLine: number;
}
/** Parse an authored checkbox block into logical items.
 *
 *  Continuation eligibility (pinned by test): a line is a continuation of the
 *  preceding checkbox when it is NONBLANK, NOT itself a checkbox, and its
 *  indentation is STRICTLY DEEPER than the checkbox line's. A next checkbox, a
 *  blank line, or same/shallower prose terminates the item. */
export declare function parseLogicalCheckboxes(block: string | null): LogicalCheckboxItem[];
//# sourceMappingURL=logical-checkbox.d.ts.map