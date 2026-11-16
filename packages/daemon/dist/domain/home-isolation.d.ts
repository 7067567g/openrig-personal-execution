/**
 * An advisory when OPENRIG_HOME is isolated but HOME or CODEX_HOME still resolve to somewhere else.
 *
 * "Isolated" means OPENRIG_HOME is not `<account home>/.openrig`, where the account home is the user's
 * passwd home, which a scratch HOME variable doesn't change. The isolation root is whichever of HOME and
 * OPENRIG_HOME contains the other (a scratch HOME carrying its own `.openrig`, or a HOME nested inside
 * OPENRIG_HOME), except that the account's own home is never a root. HOME is a leak when neither contains
 * the other, or when it is the account home (OPENRIG_HOME=~/.openrig-dev with the real HOME);
 * a root that contains the account home (OPENRIG_HOME=<account home>, or HOME=/) isn't isolated at all; CODEX_HOME (explicit, or `<HOME>/.codex`) is a leak
 * when it is outside the root. Returns undefined for the default layout and for consistent isolation.
 */
export declare function homeIsolationAdvisory(input: {
    openrigHome: string;
    home: string;
    codexHome?: string;
    accountHome?: string;
}): string | undefined;
//# sourceMappingURL=home-isolation.d.ts.map