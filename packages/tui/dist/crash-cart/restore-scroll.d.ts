/** A resolved scroll intent, or null when the event is not a scroll key. */
export type ScrollKey = "up" | "down" | null;
/** Map an input event to a scroll intent: ↑/↓ arrows and k/j (vim). Anything else → null. */
export declare function scrollKeyOf(ev: {
    type: string;
    key?: string;
    ch?: string;
}): ScrollKey;
export declare function clampScroll(offset: number, maxOffset: number): number;
/** The next scroll offset for a scroll key, clamped to [0, maxOffset]; null when `key` is not a scroll
 *  key (so the caller falls through to the phase-specific keys). Phase-agnostic BY DESIGN — the same
 *  scroll works in running, detached, and done. */
export declare function nextScrollOffset(key: ScrollKey, offset: number, maxOffset: number): number | null;
//# sourceMappingURL=restore-scroll.d.ts.map