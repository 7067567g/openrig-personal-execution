// Theme layer — the LOCKED mockup's visual treatment (baseline tarball
// d3f3bf9c, artifact e99e3b32 .tui CSS) mapped to terminal color, with sane
// degradation: truecolor renders the exact mockup palette, 256-color the
// nearest xterm cubes, 16-color the classic SGR set, and none (NO_COLOR /
// --no-color / dumb term) renders plain text. Presentation only — nothing
// here touches layout, state, or the resolver.
export function detectColorMode(env = process.env) {
    if (env["NO_COLOR"] != null && env["NO_COLOR"] !== "")
        return "none";
    const term = env["TERM"] ?? "";
    if (term === "dumb" || term === "")
        return "none";
    const colorterm = env["COLORTERM"] ?? "";
    if (/truecolor|24bit/i.test(colorterm))
        return "truecolor";
    if (/256color/.test(term))
        return "256";
    return "16";
}
// [truecolor rgb, 256 index, 16-color SGR]
const PALETTE = {
    accent: [[111, 168, 255], 111, 94],
    accentBright: [[154, 194, 255], 153, 96],
    warn: [[244, 190, 92], 221, 33],
    error: [[224, 108, 117], 167, 31],
    ok: [[152, 195, 121], 108, 32],
    info: [[143, 184, 216], 110, 94], // #8fb8d8 exact; xterm256 110, 16-color bright-blue
    dim: [[109, 116, 128], 243, 90],
    bright: [[232, 234, 240], 254, 97],
    // S19 MR5b: one-step contrast bump (founder: 'a little more noticeable')
    chrome: [[78, 105, 145], 60, 90],
    selection: [[34, 52, 82], 236, 40],
    actActive: [[152, 195, 121], 108, 32],
    actIdle: [[110, 142, 170], 109, 34],
    actDetached: [[109, 116, 128], 243, 90],
    actAttention: [[230, 181, 110], 179, 33],
    clawd: [[173, 103, 85], 131, 31],
    clawdEye: [[24, 24, 24], 234, 30],
    markInk: [[250, 250, 249], 255, 97],
    markBg: [[12, 10, 9], 233, 30],
    codexBlue: [[104, 103, 170], 61, 34],
};
export function createStyle(mode = detectColorMode()) {
    function open(token, opts) {
        if (mode === "none")
            return "";
        const parts = [];
        if (opts?.bold)
            parts.push("1");
        if (opts?.blink)
            parts.push("5");
        if (opts?.inverse)
            parts.push("7");
        const [rgb, x256, basic] = PALETTE[token];
        if (mode === "truecolor")
            parts.push(`38;2;${rgb[0]};${rgb[1]};${rgb[2]}`);
        else if (mode === "256")
            parts.push(`38;5;${x256}`);
        else
            parts.push(String(basic));
        if (opts?.bg) {
            const [brgb, b256, bBasic] = PALETTE[opts.bg];
            if (mode === "truecolor")
                parts.push(`48;2;${brgb[0]};${brgb[1]};${brgb[2]}`);
            else if (mode === "256")
                parts.push(`48;5;${b256}`);
            // 16-color: fg code + 10 = the matching bg code (30-37→40-47, 90-97→100-107)
            else
                parts.push(String(bBasic + 10));
        }
        return `\x1b[${parts.join(";")}m`;
    }
    return {
        mode,
        paint(token, text, opts) {
            if (mode === "none" || text === "")
                return text;
            return `${open(token, opts)}${text}\x1b[0m`;
        },
    };
}
const ANSI_RE = /\x1b\[[0-9;]*m/g;
/** The stylize invariant: stripping a styled line returns the plain line —
 * styling can never change layout, widths, or hit coordinates. */
export function stripAnsi(text) {
    return text.replace(ANSI_RE, "");
}
//# sourceMappingURL=theme.js.map