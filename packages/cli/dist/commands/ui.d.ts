import { Command } from "commander";
import { type LifecycleDeps } from "../daemon-lifecycle.js";
export interface UiDeps {
    lifecycleDeps: LifecycleDeps;
    exec: (cmd: string, args: string[]) => Promise<void>;
    /** Reads the daemon's own answer for the UI page. Defaults to fetch with a short timeout. */
    probeUi?: (url: string) => Promise<{
        status: number;
        headers: {
            get(name: string): string | null;
        };
    }>;
}
export declare const UI_DISABLED_GUIDANCE = "The OpenRig web UI is off on this daemon. To turn it on, run `rig config set ui.enabled true`, then stop and start the daemon (`rig daemon stop`, `rig daemon start`).";
export declare const UI_MAINTENANCE_NOTICE = "The OpenRig UI is experimental and in maintenance mode. It is not under active development; support is best-effort. The CLI is the primary supported interface. Contributions welcome.";
export declare function uiCommand(depsOverride?: UiDeps): Command;
//# sourceMappingURL=ui.d.ts.map