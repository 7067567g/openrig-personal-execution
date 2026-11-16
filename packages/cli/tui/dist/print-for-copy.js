// OPR.0.6.0.5 F1 — hand over a long value (the Slack create-app link) for exact copying. The TUI
// grid wraps and frames long text, so selecting it inside the TUI picks up borders and line
// breaks. This leaves the alternate screen, prints the value as ONE unbroken line on the normal
// screen, and returns to the TUI on Enter. What a given terminal's selection then copies from a
// soft-wrapped line is the terminal's behavior; this module only controls the bytes it prints.
// It writes nothing to the clipboard, opens nothing, and reads no input other than the Enter
// that returns.
import { ALT_SCREEN_OFF, ALT_SCREEN_ON, MOUSE_DISABLE, MOUSE_ENABLE, PASTE_DISABLE, PASTE_ENABLE } from "./input.js";
export const PRINT_FOR_COPY_RETURN_HINT = "Select the line above to copy it. Press Enter to return to OpenRig.";
const LEAVE = PASTE_DISABLE + MOUSE_DISABLE + ALT_SCREEN_OFF;
const RESTORE = ALT_SCREEN_ON + MOUSE_ENABLE + PASTE_ENABLE;
/** The exact text printed on the normal screen: heading, the value on its own unbroken line, hint. */
export function printForCopyText(label, value) {
    const oneLine = value.replace(/[\r\n]+/g, "");
    return `\r\n${label}\r\n\r\n${oneLine}\r\n\r\n${PRINT_FOR_COPY_RETURN_HINT}\r\n`;
}
/** Print `value` for copying and wait. Any failure after the first step still attempts to restore
 *  raw mode and the alternate screen, unless `mayRestore()` says the TUI is shutting down. */
export async function printForCopy(term, label, value, mayRestore = () => true) {
    try {
        term.setRawMode(false);
        term.write(LEAVE);
        term.write(printForCopyText(label, value));
        return await term.waitForEnter();
    }
    finally {
        if (mayRestore()) {
            try {
                term.setRawMode(true);
            }
            catch { /* input may already be gone */ }
            try {
                term.write(RESTORE);
            }
            catch { /* output may already be gone */ }
        }
    }
}
/** A terminal over given streams. Only Enter (CR or LF) counts as input; other input is ignored.
 *  End, close and error also settle the wait. Every listener is removed when it settles. */
export function streamCopyTerminal(stdin, stdout, setRaw) {
    return {
        write: (text) => { stdout.write(text); },
        setRawMode: setRaw,
        waitForEnter: () => new Promise((resolve) => {
            const done = (how) => {
                stdin.off("data", onData);
                stdin.off("end", onEnd);
                stdin.off("close", onClose);
                stdin.off("error", onError);
                resolve(how);
            };
            const onData = (chunk) => { if (/[\r\n]/.test(String(chunk)))
                done("enter"); };
            const onEnd = () => done("end");
            const onClose = () => done("close");
            const onError = () => done("error");
            stdin.on("data", onData);
            stdin.on("end", onEnd);
            stdin.on("close", onClose);
            stdin.on("error", onError);
        }),
    };
}
export function processCopyTerminal() {
    return streamCopyTerminal(process.stdin, process.stdout, (on) => { if (process.stdin.isTTY)
        process.stdin.setRawMode(on); });
}
/** The whole copy session as the TUI runs it. Never rejects: every outcome ends with the TUI
 *  resumed (unless it is shutting down) and a notice for anything other than a normal Enter. */
export async function runCopySession(d) {
    d.setSuspended(true);
    let outcome;
    try {
        outcome = await printForCopy(d.terminal, d.label, d.value, () => !d.isShuttingDown());
        if (outcome !== "enter")
            d.notice(`Returned from the printed link: terminal input ${outcome === "error" ? "failed" : "ended"}.`);
    }
    catch (err) {
        outcome = "failed";
        d.notice(`Could not print the link (${err instanceof Error ? err.message : String(err)}). Run: rig slack manifest --url`);
    }
    d.setSuspended(false);
    if (!d.isShuttingDown()) {
        try {
            d.draw();
        }
        catch { /* the next input or resize redraws */ }
    }
    return outcome;
}
//# sourceMappingURL=print-for-copy.js.map