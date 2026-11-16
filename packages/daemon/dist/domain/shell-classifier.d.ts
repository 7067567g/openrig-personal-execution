/**
 * KI-14 r2-B1 — the ONE shared answer to "does this pane foreground read as a
 * bare shell?". Before this module the repo carried three divergent hard-coded
 * shell sets (session-fingerprinter SHELL_NAMES, seat-identity-reconciler
 * SHELL_COMMANDS, codex-resume SHELL_COMMANDS) and the blank-slate verifier
 * grew a fourth that omitted tcsh/csh — which turned a box whose tmux
 * default-shell is /bin/tcsh into a false successor_pane_not_blank AFTER the
 * destructive cutover. Consumers should classify here; the legacy sets are a
 * tracked consolidation follow-on, not silently rewritten in a defect fix.
 */
export declare const SHELL_FOREGROUND_BASENAMES: ReadonlySet<string>;
/**
 * Does `paneCommand` (tmux `pane_current_command`) read as a bare shell?
 *
 * - Strips a login-shell "-" prefix ("-zsh" → "zsh").
 * - Accepts the common-shell set above.
 * - Accepts the basename of `expectedShellPath` when given — the caller that
 *   CHOSE the respawn command is the authority on what blank looks like, so an
 *   arbitrary configured default shell (r2's generalization) never false-fails
 *   simply for being unlisted.
 */
export declare function isShellForeground(paneCommand: string, expectedShellPath?: string | null): boolean;
//# sourceMappingURL=shell-classifier.d.ts.map