/**
 * Vendor one context pack, named by its directory, into a bundle being built.
 *
 * Used by `rig bundle create --context-pack <dir>`. The author names the
 * directory on the command line, so it may sit outside the rig folder (for
 * example a world pack whose manifest is at its repository root). Only
 * `manifest.yaml` and the files the manifest declares are carried, the same
 * set `rig context add --git` installs, so a pack at a repository root does
 * not pull in the rest of the repository.
 *
 * The pack lands at `context-packs/<manifest name>/` in the bundle, so
 * install routes it under the pack's own name. Returns the bundle-relative
 * manifest path for the bundle manifest's `context_packs` list.
 */
export declare function vendorContextPackDir(packDir: string, staging: string): string;
//# sourceMappingURL=bundle-carried-context-pack.d.ts.map