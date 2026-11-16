/** The YAML span and body offset in the original document; no YAML parsing or byte rewriting. */
export interface FrontmatterBlock {
    yaml: string;
    bodyStart: number;
}
/** Locate only the leading frontmatter boundary, preserving each reader's existing grammar. */
export declare function findFrontmatterBlock(raw: string, options?: {
    openingWhitespace?: boolean;
    consumeClosingNewline?: boolean;
}): FrontmatterBlock | null;
//# sourceMappingURL=frontmatter.d.ts.map