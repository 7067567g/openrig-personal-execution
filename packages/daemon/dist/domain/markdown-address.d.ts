export declare class AddressResolutionError extends Error {
    constructor(message: string);
}
/** ONE slug rule, simple enough to hold in memory: lowercase; markdown emphasis/code
 *  markers stripped with the text kept; every run of non-alphanumerics becomes one
 *  hyphen; leading/trailing hyphens trimmed. */
export declare function slugifyHeader(title: string): string;
export interface ParsedAddress {
    /** The pre-`#` ref — a library ref or a tree path; the caller's resolver owns it. */
    ref: string;
    /** 0 (whole file), 1 (H2) or 2 (H2/H3) slugs. */
    headerPath: string[];
}
/** Parse the one grammar form `ref` / `ref#h2` / `ref#h2/h3`. Fail-loud on anything else. */
export declare function parseAddress(address: string): ParsedAddress;
export interface MarkdownSection {
    /** Header level (2 or 3). */
    level: number;
    /** The header's raw title text. */
    title: string;
    /** This section's address path: [h2Slug] or [h2Slug, h3Slug]. */
    headerPath: string[];
    /** 0-based line of the header itself. */
    headerLine: number;
    /** FULL span (Q1): header line through the line before the next same-or-higher header. */
    text: string;
    /** OWN text: header line through the line before the next header of ANY level. */
    ownText: string;
}
/** Parse the addressable H2/H3 section tree of a markdown text.
 *  A matched section is NEVER empty by construction: the span includes the header
 *  line itself, so even a body-less `## alpha` (next line another header, or EOF)
 *  resolves to at least its own header — a matched-but-empty section can never
 *  quietly thin a compose (the structural half of the fail-loud contract; r1 A2). */
export declare function parseMarkdownSections(text: string): MarkdownSection[];
/** Resolve a header path against markdown text. FAIL-LOUD: no match is an error that
 *  names the miss and the real candidates at that altitude — never a silent empty. */
export declare function resolveAddress(text: string, headerPath: string[]): MarkdownSection;
export type AddressabilityFinding = {
    kind: "duplicate-header-path";
    headerPath: string;
    lines: number[];
} | {
    kind: "unaddressable-header";
    headerPath: string;
    line: number;
    title: string;
} | {
    kind: "unterminated-fence";
    line: number;
};
/** The compose-gate validator: every H2/H3 must be uniquely addressable under the one
 *  slug rule, and the file must not silently lose sections. Findings, not throws —
 *  the caller decides the gate. */
export declare function validateMarkdownAddressability(text: string): AddressabilityFinding[];
//# sourceMappingURL=markdown-address.d.ts.map