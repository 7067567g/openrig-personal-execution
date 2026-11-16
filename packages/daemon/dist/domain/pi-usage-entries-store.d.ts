import type { Database } from "better-sqlite3";
import type { PiUsageFact } from "./pi-usage-facts.js";
import { type PiProviderCharge } from "./openrouter-charge.js";
export declare function hasPiUsageChargesTable(db: Database): boolean;
export declare function hasPiUsageEntriesTable(db: Database): boolean;
/** A posted charge outcome, checked field by field; null when it doesn't have the shape the runner sends. */
export declare function validPiProviderCharge(raw: unknown): PiProviderCharge | null;
/** A posted fact, checked field by field; null when it doesn't have the shape the runner sends. */
export declare function validPiUsageFact(raw: unknown): PiUsageFact | null;
export declare class PiUsageEntriesStore {
    private readonly db;
    private readonly chargeColumns;
    constructor(db: Database);
    /** Of these entries, the ones that already have a recorded OpenRouter charge (a restarted runner skips them). */
    chargedEntryIds(piSessionId: string, entryIds: string[]): string[];
    /** Record charge outcomes for entries already stored for this seat and session. A charged row is final; an
     *  unavailable one can become charged; anything else is a replay and changes nothing. Facts never stored, or
     *  stored for another seat, are refused. */
    recordCharges(input: {
        seatSession: string;
        piSessionId: string;
        charges: PiProviderCharge[];
    }, recordedAt: string): {
        stored: number;
        unchanged: number;
        refused: number;
        acknowledged: string[];
    };
    /** Store each fact once. Returns how many were new (or had an unknown origin settled) and how many were already stored. */
    record(input: {
        seatSession: string;
        nodeId: string | null;
        generation: string | null;
        piSessionId: string;
        facts: PiUsageFact[];
    }, recordedAt: string): {
        stored: number;
        duplicates: number;
    };
}
//# sourceMappingURL=pi-usage-entries-store.d.ts.map