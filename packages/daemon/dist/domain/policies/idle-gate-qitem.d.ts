import type Database from "better-sqlite3";
import type { SeatActivityService } from "../seat-activity-service.js";
import type { Policy } from "./types.js";
export interface IdleGateQitemDeps {
    db: Database.Database;
    /**
     * Consume the same arbitrated activity oracle as the public surfaces. Only
     * `getSeatStateBySession` is used; typed as a Pick so unit tests can inject
     * a lightweight seam without constructing a second oracle.
     */
    seatActivity: Pick<SeatActivityService, "getSeatStateBySession">;
}
export declare function makeIdleGateQitemPolicy(deps: IdleGateQitemDeps): Policy;
//# sourceMappingURL=idle-gate-qitem.d.ts.map