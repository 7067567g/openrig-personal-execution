/**
 * Registers a bundle's project in the workspace catalog and records which rig
 * works in it, before that rig's first turn.
 *
 * The record is an optional `rigs` list on the catalog entry:
 *   projects: [{ id, root, rigs: [<rig name>] }]
 * `rig context work-install` reads it to resolve a seat's project from its rig.
 * The entry names a catalog id and a root; nothing else stores the path.
 *
 * Rules (agreed with the work-install selection order):
 * 1. The catalog is found through workspace.catalog_path, never a literal.
 * 2. An existing catalog is never rewritten: every byte already there stays.
 *    A new entry is appended as text in the file's own indentation and line
 *    endings, and a rig joins an entry by a one-line edit of its `rigs: [...]`.
 *    Each edit is checked by re-parsing. When neither applies (for example a
 *    flow-style list), nothing is written and the result gives the exact line
 *    to add. Only a catalog created from scratch is written whole.
 * 3. An entry with the same id and the same canonical root is the same
 *    project: the rig name is added once, so reinstalling changes nothing.
 * 4. If the id is taken by another root, the root is registered under another
 *    id, or the rig is already listed under another project, nothing is
 *    written for that part. The result says so, with the fix; it is reported,
 *    never thrown.
 */
export interface ProjectRegistrationInput {
    /** Extracted project folder from the bundle (holds project.yaml). */
    bundleProjectDir: string;
    projectId: string;
    rigName: string;
    /** workspace.projects_root: the project folder is materialized at <projectsRoot>/<id>. */
    projectsRoot: string;
    /** workspace.root: a catalog written from scratch keeps it as the default project. */
    workspaceRoot: string;
    /** workspace.catalog_path. */
    catalogPath: string;
}
export interface ProjectRegistrationResult {
    /** registered: entry added; associated: rig added to an existing entry; already_registered: nothing to change; conflict: nothing written for the catalog part. */
    status: "registered" | "associated" | "already_registered" | "conflict";
    projectId: string;
    projectRoot: string;
    catalogPath: string;
    rigName: string;
    /** The project folder already existed with different files; it was kept unchanged. */
    projectFolderKept?: boolean;
    detail?: string;
}
export declare function registerBundleProject(input: ProjectRegistrationInput): ProjectRegistrationResult;
//# sourceMappingURL=project-registration.d.ts.map