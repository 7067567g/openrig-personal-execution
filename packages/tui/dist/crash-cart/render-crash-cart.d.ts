import type { Token } from "../theme.js";
import type { CrashCartModel } from "./crash-cart-model.js";
import type { DaemonUnverifiedEvidence } from "./contract.js";
import type { RestoreLifecycleVM } from "./restore-lifecycle.js";
interface Seg {
    text: string;
    token?: Token;
    bold?: boolean;
    bg?: Token;
    inverse?: boolean;
}
interface Line {
    text: string;
    segs?: Seg[];
    selected?: boolean;
}
/** The daemon-down header: `◌ daemon not running` (warn) + the dim status tail. The uptime + reason
 *  slots render EXPLICIT honest-unknown text (PM ruling) — structure/ordering per the mock. */
export declare function renderCrashCartHeader(model: CrashCartModel): Line;
/** `FOUND ON THIS HOST` + one row per rig: `▦ <name>  <n> seats · last active <t> · <r> sessions resumable`.
 *  Name column is padded to the widest name + a 4-space gap so the details align (the mock's fixed columns). */
export declare function renderFoundOnHost(model: CrashCartModel): Line[];
/** `WHERE WORK STOPPED (from the durable ledgers)` + one `◌ <session> — qitem in-progress: "<summary>" (<t>)`
 *  per in-progress item, then always the `✓ everything else idle-clean at stop` closing line. */
export declare function renderWhereWorkStopped(model: CrashCartModel): Line[];
/** The actions block: the highlighted primary `⏎ RESTORE EVERYTHING …` row + the secondary key row. */
export declare function renderActions(): Line[];
/** First-run framing (DOWN + no DB): a fresh host, NOT a crash — onboarding, never a crash header or
 *  a RESTORE-of-nothing (PM ruling: crash language requires evidence of prior life). */
export declare function renderFirstRunView(): Line[];
/** The whole crash-cart cockpit view: recovery = header → FOUND ON THIS HOST → WHERE WORK STOPPED →
 *  actions (mock-verbatim ordering); first-run = onboarding framing. */
export declare function renderCrashCartView(model: CrashCartModel): Line[];
/** The RESTORE LIFECYCLE view (B1 ROUND 2). While running: a live header + a per-rig progress list
 *  updated from each poll (the rollup stream) + the cancel affordance. When done: the verdict + counts
 *  and the SHIPPED keyboard-walkable triage list (renderTriage) — each seat/rig on its own row with its
 *  EXACT need, NOT a width-clipped one-line footer summary. */
export declare function renderRestoreLifecycleView(vm: RestoreLifecycleVM): Line[];
/** B1 ROUND 10 — the ⏎ confirm banner, rendered at the TOP of the cockpit so the operator SEES the
 *  confirmation where they look. The first ⏎ used to be invisible because the confirm went to
 *  ViewState.notice, which the daemon-down cockpit does not render. The message already names the deltas
 *  and the ⏎-proceed / Esc-cancel affordance. */
export declare function renderConfirmBanner(message: string): Line[];
/** The UNVERIFIED screen (planner+PM ruling): a minimal DISTINCT view — evidence VERBATIM + retry +
 *  quit + the rig-status hint, and ZERO recovery actions (never the cockpit, never RESTORE). */
export declare function renderUnverifiedView(evidence: DaemonUnverifiedEvidence): Line[];
export {};
//# sourceMappingURL=render-crash-cart.d.ts.map