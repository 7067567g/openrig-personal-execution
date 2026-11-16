export type ColorMode = "truecolor" | "256" | "16" | "none";
export declare function detectColorMode(env?: NodeJS.ProcessEnv): ColorMode;
/** Semantic tokens — named for meaning, not color, so views stay honest. */
export type Token = "accent" | "accentBright" | "warn" | "error" | "ok" | "info" | "dim" | "bright" | "chrome" | "selection" | "actActive" | "actIdle" | "actDetached" | "actAttention" | "clawd" | "clawdEye" | "markInk" | "markBg" | "codexBlue";
export interface Style {
    /** wrap text in the token's SGR (plus bold/inverse); identity in "none" mode */
    paint(token: Token, text: string, opts?: {
        bold?: boolean;
        inverse?: boolean;
        bg?: Token;
        blink?: boolean;
    }): string;
    readonly mode: ColorMode;
}
export declare function createStyle(mode?: ColorMode): Style;
/** The stylize invariant: stripping a styled line returns the plain line —
 * styling can never change layout, widths, or hit coordinates. */
export declare function stripAnsi(text: string): string;
//# sourceMappingURL=theme.d.ts.map