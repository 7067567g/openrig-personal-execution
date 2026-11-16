import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig unarchive <rigId>` - OPR.0.3.3.19. Reverse of `rig archive`: clears the
 * `archived_at` flag so the rig returns to the default explorer + `rig ps` view.
 * Always non-destructive (the row and snapshots were retained while archived);
 * no `--force` and no running-rig guard - unarchiving only makes a rig visible.
 */
export declare function unarchiveCommand(depsOverride?: StatusDeps): Command;
//# sourceMappingURL=unarchive.d.ts.map