import type { Action, InputEvent, Screen, ViewState } from "./types.js";
export interface InputDecoder {
    write(bytes: string | Buffer): InputEvent[];
    flush(): InputEvent[];
    /** true while a split escape sequence (or a lone Esc) is being held for more bytes —
     * the caller flushes after a short quiet gap so a bare Esc keypress is delivered. */
    hasPending(): boolean;
}
/** Stateful terminal-stream decoder: retains split escape sequences and uses
 * Node's StringDecoder so UTF-8 code points survive arbitrary Buffer chunks. */
export declare function createInputDecoder(): InputDecoder;
/** Whole-buffer convenience used by tests and synthetic adapters. */
export declare function decodeInput(bytes: string | Buffer): InputEvent[];
/** Test/automation helper: the SGR bytes a terminal emits for a left click at (x, y). */
export declare function sgrClick(x: number, y: number): string;
/** Resolve the back control advertised by SCOPES detail pages. */
export declare function resolveEscapeAction(event: Extract<InputEvent, {
    type: "key";
}>, state: ViewState, commandEditing?: boolean): Action | null;
/** Resolve directional/Enter keys against the currently rendered pane. */
export declare function resolveKeyAction(event: Extract<InputEvent, {
    type: "key";
}>, state: ViewState, screen: Screen, explorerCount: number): Action | null;
/** Route a wheel notch using the pane actually under the pointer. Clicks keep
 * using the renderer hit-map in the caller; this function only owns wheels. */
export declare function resolveMouseAction(event: Extract<InputEvent, {
    type: "mouse";
}>, state: ViewState, screen: Screen, explorerCount: number): Action | null;
export declare const PASTE_ENABLE = "\u001B[?2004h";
export declare const PASTE_DISABLE = "\u001B[?2004l";
export declare const MOUSE_ENABLE = "\u001B[?1000h\u001B[?1006h";
export declare const MOUSE_DISABLE = "\u001B[?1006l\u001B[?1000l";
export declare const ALT_SCREEN_ON = "\u001B[?1049h\u001B[?25l";
export declare const ALT_SCREEN_OFF = "\u001B[?25h\u001B[?1049l";
//# sourceMappingURL=input.d.ts.map