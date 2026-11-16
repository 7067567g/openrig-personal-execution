/** Shell-quote a string using single quotes (POSIX-safe). */
export function shellQuote(s) {
    return "'" + s.replace(/'/g, "'\"'\"'") + "'";
}
//# sourceMappingURL=shell-quote.js.map