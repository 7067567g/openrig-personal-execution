export interface RestoreInputEvent {
    type: string;
    ch?: string;
    key?: string;
}
export interface RestoreInputContext {
    phase: "running" | "detached" | "done";
    cancelled: boolean;
    offset: number;
    maxOffset: number;
}
export type RestoreAction = {
    kind: "quit";
} | {
    kind: "scroll";
    offset: number;
} | {
    kind: "cancel";
} | {
    kind: "reattach";
} | {
    kind: "cancel-reattach";
} | {
    kind: "dismiss";
} | {
    kind: "none";
};
/** Resolve one key in a restore phase to an action. Order: quit, then scroll (advertised in EVERY phase
 *  when the content overflows — so it must ACT in every phase), then the phase-specific lifecycle keys.
 *  A cancel already requested is NOT re-offered (the render drops `c cancel` once `cancelled`). */
export declare function restoreKeyAction(ev: RestoreInputEvent, ctx: RestoreInputContext): RestoreAction;
//# sourceMappingURL=restore-input.d.ts.map