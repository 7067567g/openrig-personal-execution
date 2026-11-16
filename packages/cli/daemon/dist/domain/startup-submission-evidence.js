import { createHash } from "node:crypto";
import { composerPromptClassForRuntime, composerPromptIsAmbiguous, composerSelectionPrefixPattern, findComposerInputLineIndex, } from "./composer-prompts.js";
const normalize = (text) => text.replace(/\s+/g, "");
// Claude 2.1.289 briefly replaces its mode bar after a bracketed paste.
// The hint is the bare line or carries an effort suffix, which depends on the seat's effort setting.
// Vim mode puts `-- INSERT --` ahead of either footer, and a narrow pane truncates the mode bar's hint,
// so a mode-bar line is also known by its leading marker.
const VIM_MODE_PREFIX = /^-- INSERT --\s*/;
const MODE_BAR_START = /^(?:⏵⏵|⏸)(?:\s|$)/;
// The suffix is a circle glyph and an effort level, e.g. `◐ medium` or `● high`; arbitrary text is not one.
const PASTE_HINT = /^paste again to expand(?:\s{2,}[◐●○◑◒◓] (?:low|medium|high|xhigh|max) · \/effort)?$/;
const isComposerFooter = (line) => {
    const bar = line.replace(VIM_MODE_PREFIX, "");
    return (bar === "" && line !== "") || /(?:shift\+tab to cycle|\? for shortcuts)/i.test(bar) || MODE_BAR_START.test(bar)
        || PASTE_HINT.test(bar);
};
// This placeholder occupies an empty composer while submitted text is queued.
export const QUEUED_PLACEHOLDER = normalize("Press up to edit queued messages");
/** The same composer region used by the startup Enter guard. No transcript fallback. */
export function composerRegion(pane, runtime = null) {
    const promptClass = composerPromptClassForRuntime(runtime);
    const lines = (pane ?? "").split("\n");
    const inputAt = findComposerInputLineIndex(lines, promptClass);
    let end = -1;
    if (inputAt >= 0) {
        // Prompt text can itself contain rules (the startup challenge does), and a rule in the prompt can be followed by a
        // line that looks like a mode bar. The composer's closing rule is the last rule on the screen: only the footer
        // lines come after it. An unrecognized footer under it leaves the region unverified rather than falling back to
        // a rule inside the prompt.
        for (let i = lines.length - 1; i > inputAt; i--) {
            if (!/^[─═-]{10,}$/.test(lines[i].trim()))
                continue;
            if (isComposerFooter((lines.slice(i + 1).find((next) => next.trim()) ?? "").trim()))
                end = i;
            break;
        }
    }
    const body = inputAt < 0 || end < 0 || composerPromptIsAmbiguous(lines, inputAt, promptClass)
        || composerSelectionPrefixPattern(promptClass).test(lines[inputAt].trimStart())
        ? null : normalize(lines.slice(inputAt, end).join("\n").trimStart().slice(1));
    return { body, markerLine: inputAt < 0 ? null : inputAt + 1,
        closingRuleLine: end < 0 ? null : end + 1, capturedLines: pane === null ? 0 : lines.length };
}
/** An echoed turn or a partial/opaque composer stays unverified. */
export function inspectStartupStagedText(pane, expected, runtime = null) {
    const { body } = composerRegion(pane, runtime);
    if (body === null)
        return "unverified";
    if (!body)
        return "clear";
    if (body === normalize(expected))
        return "staged";
    return body === QUEUED_PLACEHOLDER ? "clear" : "unverified";
}
// Claude 2.1.289 shows a long bracketed paste as this label until it is submitted; +M is the number of
// newlines in the pasted text (8 of 8 pastes in retained native runs). Matched on the normalized body.
export const COLLAPSED_PASTE = /^\[Pastedtext#\d+\+(\d+)lines\]$/;
/** Whether the composer holds only Claude's collapsed label for a paste with the expected text's newline count. */
export function startupOwnCollapsedPaste(pane, expected, runtime = null) {
    const { body } = composerRegion(pane, runtime);
    const label = body === null ? null : COLLAPSED_PASTE.exec(body);
    return label !== null && Number(label[1]) === expected.split("\n").length - 1;
}
/** No excerpts: every startup source accepts arbitrary, potentially credential-bearing text.
 * Fixed-size metadata per capture (at most three per send), never a pane/prompt dump.
 * Diagnostics must not turn a delivery decision into a failure. */
export function startupSubmissionEvidence(pane, expected, captureScrollbackLines, runtime = null) {
    try {
        const { body, ...positions } = composerRegion(pane, runtime);
        const expectedBytes = Buffer.from(normalize(expected));
        const observedBytes = body === null ? null : Buffer.from(body);
        const digest = (bytes) => ({ bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
        let firstDifferenceByte = null;
        if (observedBytes !== null) {
            let i = 0;
            while (i < expectedBytes.length && i < observedBytes.length && expectedBytes[i] === observedBytes[i])
                i++;
            if (i !== expectedBytes.length || i !== observedBytes.length)
                firstDifferenceByte = i;
        }
        const reason = !pane?.trim() ? undefined
            : positions.markerLine === null || positions.closingRuleLine === null ? "unrecognized_composer_boundary"
                : observedBytes !== null && firstDifferenceByte !== null ? "extracted_text_mismatch" : undefined;
        return { normalization: "whitespace-stripped-utf8", expected: digest(expectedBytes),
            observed: observedBytes === null ? null : digest(observedBytes), ...positions,
            ...(reason ? { reason } : {}),
            captureScrollbackLines, firstDifferenceByte, windowsOmitted: "unclassified-startup-text" };
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=startup-submission-evidence.js.map