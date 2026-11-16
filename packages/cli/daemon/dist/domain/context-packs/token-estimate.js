/** Cheap stable token estimate shared by store and assembly projections. */
export function estimateTokensFromBytes(bytes) {
    return Math.ceil(bytes / 4);
}
//# sourceMappingURL=token-estimate.js.map