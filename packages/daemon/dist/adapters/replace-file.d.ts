/**
 * Replace a file through exclusively created sibling staging and an atomic rename.
 * Preserve the source mode so read-only packaged assets can be provisioned repeatedly.
 * Never follow an existing temporary slot, and clean only this invocation's staging.
 * If staging creation fails, retain the prior in-place copy behavior and its error.
 */
export declare function replaceFile(src: string, dest: string): void;
//# sourceMappingURL=replace-file.d.ts.map