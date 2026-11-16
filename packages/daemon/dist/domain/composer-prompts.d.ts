/**
 * One place for the composer/prompt glyphs and the shapes built from them.
 *
 * The send-readiness classifier, the staged-input inspector, the startup
 * submission guard and the CLI's staged-at-prompt detector all have to agree on
 * what a composer prompt looks like. They used to each carry their own copy:
 * Claude Code draws `❯`, Codex draws `›`, and Codex 0.153 variants draw `»`
 * (#79). A renderer change or a new glyph must land here once, so the send
 * verify path and the staged-input check can never disagree.
 */
/** Every glyph a harness has been observed to draw as its composer prompt. */
export declare const COMPOSER_PROMPT_CHARS: readonly ["❯", "›", "»"];
/** Character-class fragment (without brackets) for the prompt glyphs. */
export declare const COMPOSER_PROMPT_CLASS: string;
/**
 * The glyph set for one runtime. A Claude pane uses `❯`; a Codex pane uses `›`
 * (and `»` on 0.153 variants). Only an unknown runtime takes the union, because
 * a multi-line draft's continuation can itself start with another harness's
 * glyph (a quoted Codex line inside a Claude draft, say), and taking the last
 * such line as the composer would misread the staged text.
 */
export declare function composerPromptClassForRuntime(runtime: string | null | undefined): string;
/** A numbered option line (`❯ 1. Yes`, `› 2. No`): a prompt selection, never staged input. */
export declare const COMPOSER_SELECTION_PATTERN: RegExp;
/** Same selection shape, matched line-wise across a multi-line scan window. */
export declare const COMPOSER_SELECTION_SCAN_PATTERN: RegExp;
/**
 * The broader numbered-option exclusion the staged-input checks always had:
 * number plus dot, with or without a space (`❯ 1.Yes` is still a selector). A
 * compact option must never be confirmed or healed as staged text.
 */
export declare function composerSelectionPrefixPattern(promptClass?: string): RegExp;
/**
 * A numbered-option line with either separator (`❯ 1. Yes`, `› 1) No`, `» 2) Later`):
 * a prompt selection, never the typed answer. The prompt-answer path accepts both
 * `.` and `)` after the number, unlike the staged-input prefix exclusion above.
 */
export declare function composerNumberedChoicePattern(promptClass?: string): RegExp;
/** Empty composer: prompt glyph, optional whitespace, end of line. */
export declare const COMPOSER_EMPTY_PATTERN: RegExp;
/** Codex renders a fixed placeholder in its empty composer (`›` or 0.153's `»`). */
export declare const COMPOSER_EMPTY_CODEX_PLACEHOLDER_PATTERN: RegExp;
/** Draft present: prompt glyph followed by non-whitespace text. */
export declare const COMPOSER_DRAFT_PATTERN: RegExp;
/** True when a line begins with any composer prompt glyph (union default). */
export declare const COMPOSER_PROMPT_LINE_PATTERN: RegExp;
/**
 * Index of the last composer prompt line in a capture, or -1 when the capture
 * carries none. Only the last one can be the current input; everything above it
 * is transcript history and a bare Enter there could drive an old prompt.
 * `promptClass` scopes the glyphs to a known runtime; the union is the default
 * for callers that have no runtime (the advisory classifier and CLI detector).
 */
export declare function findComposerInputLineIndex(lines: string[], promptClass?: string): number;
/** Strip a leading prompt glyph from a composer line. */
export declare function stripComposerPromptGlyph(line: string, promptClass?: string): string;
/**
 * Distinct prompt glyphs in the capture up to and including `inputIndex`.
 * The walk does not stop at a blank line or a rule: a multi-line draft can
 * hold either, and the ambiguous unknown-runtime read has to see the
 * unrelated first line that precedes them.
 */
export declare function composerGlyphKindsInBlock(lines: string[], inputIndex: number): Set<string>;
/**
 * True when an unknown-runtime read of this composer block is ambiguous: the
 * block holds more than one prompt glyph kind, so there is no runtime to say
 * which line is the live input. A caller must keep the union for unknown
 * runtimes but fail closed here, exactly as the pre-shared-matcher check did.
 */
export declare function composerPromptIsAmbiguous(lines: string[], inputIndex: number, promptClass?: string): boolean;
//# sourceMappingURL=composer-prompts.d.ts.map