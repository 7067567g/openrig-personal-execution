import { Command } from "commander";
import { type FrontDoorIo } from "../front-door.js";
/** The registry-entry shape `rig tui commands` serializes (REGISTRY I2, ruling 64f1dbdf).
 *  Structural mirror of the TUI's CommandEntry data fields (functions are not serialized). */
export interface TuiCommandEntry {
    name: string;
    aliases: string[];
    args: string;
    description: string;
    context: string;
    sample: string;
}
export declare function tuiCommand(io?: FrontDoorIo & {
    loadRegistry?: () => Promise<TuiCommandEntry[]>;
    sharedTarget?: () => Promise<string>;
    attachShared?: (target: string) => Promise<number>;
}): Command;
//# sourceMappingURL=tui.d.ts.map