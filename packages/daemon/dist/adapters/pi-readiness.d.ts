/** The daemon and pane may resolve different executables. Never turn a
 * version observation into a new launch refusal or echo arbitrary stdout. */
export declare function piVersionNotice(output: string): string;
/** Which credential Pi will resolve for a provider in the EXACT managed child environment and agent directory,
 * in Pi's own order: a stored sign-in or key in auth.json, then a models.json provider key, then the provider's
 * environment key. Metadata only: no global login read, credential command, refresh or API request, and never a
 * credential value. Presence is not a successful authentication claim. Pi's own loader remains authoritative
 * (including extension/custom-provider credentials). Shapes: earendil-works/pi v0.87.1 auth-storage.ts and
 * docs/models.md. */
/** Whether a models.json provider entry can change how Pi authenticates for that provider (Pi 0.87.1
 *  provider-composer.js): a key, OAuth, headers, an auth header, or a base URL (where the key is sent), on the
 *  entry or on any of its custom models or model overrides. An entry that only adds or adjusts models without
 *  these keeps the inherited credential (for OpenRouter, the environment key). */
export declare function providerEntryAuth(entry: unknown): "none" | "bearing" | "unknown";
/** Pi 0.87.1 parses models.json as JSON.parse(stripJsonComments(stripBom(text))) (model-config.js, utils/json.js):
 *  `//` line comments outside strings and trailing commas are removed. The same here, so a file Pi reads is read. */
export declare function parsePiModelsJson(text: string): unknown;
export type PiCredentialSource = {
    kind: "stored-sign-in" | "stored-key" | "models-key";
    provider: string;
} | {
    kind: "managed-env";
    provider: string;
    envVar: string;
} | {
    kind: "none";
    provider: string;
    envVar: string | undefined;
} | {
    kind: "unknown";
};
export declare function piCredentialSource(opts: {
    model?: string;
    agentDir: string;
    env: Readonly<Record<string, string | undefined>>;
    readFile: (file: string) => string;
}): PiCredentialSource;
/** Advisory launch notice from {@link piCredentialSource}. */
export declare function piCredentialNotice(opts: {
    model?: string;
    agentDir: string;
    env: Readonly<Record<string, string | undefined>>;
    readFile: (file: string) => string;
}): string;
/** OPR.0.7.0.2 K4: what metadata shows about Pi's OpenRouter credential at one moment. Pi records no
 *  per-request credential, so a request's credential is established by two of these, taken before and after
 *  it (see judgeChargeProvenance). Metadata only: credential files are classified, never used; settings are
 *  read only for extension entries; extension directories are listed, never loaded. */
export type PiCredentialEvidence = {
    at: number;
    source: PiCredentialSource;
    /** Whether a Pi extension could load (and so register a provider or a runtime key): Pi 0.87.1 discovers
     *  <agentDir>/extensions, <cwd>/.pi/extensions, and `packages`/`extensions` entries in either settings.json.
     *  OpenRig passes no -e flags. */
    extensions: "none" | "present" | "unknown";
    /** Whether models.json has an OpenRouter provider entry that can change authentication (providerEntryAuth),
     *  whichever credential wins and whether or not its key is literal: Pi's provider composer holds it from load
     *  until a reload. A credential-free entry (models only) is "none". */
    modelsOpenRouterEntry: "none" | "present" | "unknown";
    /** Identity of every file and directory above, so a change between two observations is visible. */
    fingerprint: string;
};
export declare function piCredentialEvidence(opts: {
    agentDir: string;
    cwd: string;
    env: Readonly<Record<string, string | undefined>>;
    now: () => number;
    /** "absent", or a stable identity for a file (e.g. ino:size:mtime). */
    statId: (file: string) => string;
    /** Entry names of a directory; [] when it doesn't exist. Throws when it can't be read. */
    listDir: (dir: string) => string[];
    readFile: (file: string) => string;
}): PiCredentialEvidence;
/** What, seen in any observation of this runner process, Pi may still hold until it restarts: an extension
 *  (Pi 0.87.1 loads extensions at start and again only on an explicit /reload) or a models.json OpenRouter key
 *  (Pi loads models.json at start and again only on an explicit refresh). Clean files later don't change what
 *  the running Pi loaded, so once seen, this is sticky for the process. */
export declare function credentialTaint(e: PiCredentialEvidence): {
    sticky: string;
} | null;
/** Whether a request's credential is established as the key OpenRig forwarded: it was persisted after `before`
 *  and observed by `after`, both show Pi's OpenRouter credential as that key with no extension able to replace
 *  it, and nothing changed in between. Otherwise the reason it isn't. */
export declare function judgeChargeProvenance(before: PiCredentialEvidence | null, after: PiCredentialEvidence, entryTimestamp: string): {
    ok: true;
    credentialSource: string;
} | {
    ok: false;
    reason: string;
};
//# sourceMappingURL=pi-readiness.d.ts.map