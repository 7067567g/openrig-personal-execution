import path from "node:path";
import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";
export const CMUX_SETTINGS_DISCLOSURE_PATH = "~/.config/cmux/settings.json";
export const CMUX_DEFAULT_SOCKET_CONTROL_MODE = "cmuxOnly";
const CMUX_INCOMPATIBLE_MODES = new Set(["off", "cmuxOnly"]);
export function resolveCmuxSettingsPath(homeDir = process.env["HOME"] ?? "~") {
    return path.join(homeDir, ".config", "cmux", "settings.json");
}
export function isCmuxSocketControlCompatible(mode) {
    return typeof mode === "string" && !CMUX_INCOMPATIBLE_MODES.has(mode);
}
export function readCmuxSocketControlModeFromText(text) {
    if (!text || !text.trim()) {
        return { mode: CMUX_DEFAULT_SOCKET_CONTROL_MODE, source: "default" };
    }
    const errors = [];
    const parsed = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
    if (errors.length > 0) {
        return {
            mode: CMUX_DEFAULT_SOCKET_CONTROL_MODE,
            source: "settings",
            error: formatParseErrors(errors),
        };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
            mode: CMUX_DEFAULT_SOCKET_CONTROL_MODE,
            source: "settings",
            error: "cmux settings must contain a JSON object.",
        };
    }
    const automation = parsed["automation"];
    if (!automation || typeof automation !== "object" || Array.isArray(automation)) {
        return { mode: CMUX_DEFAULT_SOCKET_CONTROL_MODE, source: "default" };
    }
    const mode = automation["socketControlMode"];
    if (typeof mode === "string" && mode.trim()) {
        return { mode, source: "settings" };
    }
    return { mode: CMUX_DEFAULT_SOCKET_CONTROL_MODE, source: "default" };
}
export function upsertCmuxSocketControlMode(text, mode) {
    const source = text && text.trim() ? text : "{\n}\n";
    const edits = modify(source, ["automation", "socketControlMode"], mode, {
        formattingOptions: {
            insertSpaces: true,
            tabSize: 2,
            eol: "\n",
        },
    });
    if (edits.length === 0) {
        return { content: ensureTrailingNewline(source), changed: false };
    }
    return {
        content: ensureTrailingNewline(applyEdits(source, edits)),
        changed: true,
    };
}
function ensureTrailingNewline(text) {
    return text.endsWith("\n") ? text : `${text}\n`;
}
function formatParseErrors(errors) {
    return errors
        .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
        .join("; ");
}
//# sourceMappingURL=cmux-config.js.map