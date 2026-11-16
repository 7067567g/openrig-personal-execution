import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig archive <rigId>` - OPR.0.3.3.19. Soft, REVERSIBLE archive: hides a rig
 * from the default explorer + `rig ps`, while RETAINING the rigs row, topology,
 * and snapshots. This is NOT `rig down --delete` (which is destructive). Reverse
 * with `rig unarchive <rigId>`. Running/degraded rigs require `--force`.
 */
export declare function archiveCommand(depsOverride?: StatusDeps): Command;
//# sourceMappingURL=archive.d.ts.map