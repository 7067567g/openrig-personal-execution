export declare const PRINT_FOR_COPY_RETURN_HINT = "Select the line above to copy it. Press Enter to return to OpenRig.";
/** The exact text printed on the normal screen: heading, the value on its own unbroken line, hint. */
export declare function printForCopyText(label: string, value: string): string;
/** How the wait ended: the user pressed Enter, or terminal input ended, closed or failed. */
export type CopyWaitEnd = "enter" | "end" | "close" | "error";
export interface CopyTerminal {
    write(text: string): void;
    setRawMode(on: boolean): void;
    /** Settles on the next Enter, or when input ends, closes or errors. Never rejects. */
    waitForEnter(): Promise<CopyWaitEnd>;
}
/** Print `value` for copying and wait. Any failure after the first step still attempts to restore
 *  raw mode and the alternate screen, unless `mayRestore()` says the TUI is shutting down. */
export declare function printForCopy(term: CopyTerminal, label: string, value: string, mayRestore?: () => boolean): Promise<CopyWaitEnd>;
type InputStream = Pick<NodeJS.EventEmitter, "on" | "off">;
/** A terminal over given streams. Only Enter (CR or LF) counts as input; other input is ignored.
 *  End, close and error also settle the wait. Every listener is removed when it settles. */
export declare function streamCopyTerminal(stdin: InputStream, stdout: {
    write(text: string): unknown;
}, setRaw: (on: boolean) => void): CopyTerminal;
export declare function processCopyTerminal(): CopyTerminal;
export interface CopySessionDeps {
    terminal: CopyTerminal;
    label: string;
    value: string;
    /** Suspend or resume the TUI's own input handling and drawing. */
    setSuspended(on: boolean): void;
    isShuttingDown(): boolean;
    notice(message: string): void;
    draw(): void;
}
/** The whole copy session as the TUI runs it. Never rejects: every outcome ends with the TUI
 *  resumed (unless it is shutting down) and a notice for anything other than a normal Enter. */
export declare function runCopySession(d: CopySessionDeps): Promise<CopyWaitEnd | "failed">;
export {};
//# sourceMappingURL=print-for-copy.d.ts.map