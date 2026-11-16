// OPR.0.4.6.02 C2 — the TerminalProvider abstraction (the CORE seam of the
// terminal-provider ride).
//
// A provider renders an ALREADY-COMPOSED view into its own surface model
// (herdr workspace/tab/pane; cmux workspace/surface). It NEVER composes the
// pane command itself — pane-command composition lives entirely in
// `view-composer.ts`, which emits provider-neutral `ComposedPane.paneCommand`
// strings. The provider's only job is placement + labeling + liveness. This
// split keeps the composition rules (local vs ssh vs http honest-degrade,
// read-only `-r`, paging) in one pure, testable place regardless of which
// provider paints the tiles.
//
// The one shared result shape is `{ opened, absent, degraded }` (BR-6
// honest-partial): a view that can only partially render says so explicitly —
// never a silent omission.
export {};
//# sourceMappingURL=terminal-provider.js.map