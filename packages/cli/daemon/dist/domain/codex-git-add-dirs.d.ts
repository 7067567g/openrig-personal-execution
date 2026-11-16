/** The git metadata directories a Codex workspace-write seat may write, for its fresh-launch `--add-dir`s. */
export type CodexGitAddDirResolver = (cwd: string) => Promise<string[]>;
/**
 * Issue #121. `<cwd>/.git` is a directory in an ordinary repository, but a FILE ("gitdir: ...") in a linked
 * worktree or submodule; Codex's Linux sandbox cannot mount under a file, so passing it breaks every command.
 *
 * - `.git` is a directory: `[<cwd>/.git]`, as before.
 * - `.git` does not exist: `[<cwd>/.git]`, as before. Nothing reported fails for this case, and changing it
 *   is outside the fix.
 * - `.git` is a file: the absolute git dir and common git dir from `git rev-parse`, keeping only existing
 *   directories (a linked worktree needs both to commit).
 * - Anything unresolvable (unreadable `.git`, malformed gitdir, git missing or failing): `[]`. The seat still
 *   launches; it simply gets no extra git write access, instead of a broken path that fails every command.
 */
export declare const resolveCodexGitAddDirs: CodexGitAddDirResolver;
//# sourceMappingURL=codex-git-add-dirs.d.ts.map