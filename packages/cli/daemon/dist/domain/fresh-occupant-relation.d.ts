import type Database from "better-sqlite3";
/** Read an existing fresh-launch effect, fenced by the current generation.
 * Older builds could leave a detached predecessor unsuperseded. The owning
 * event still names the deliberate successor: timestamps and newest-row
 * guesses are unnecessary. No history or native identity is rewritten here.
 */
export declare function readFreshOccupantRelations(db: Database.Database, rigId: string): Record<string, string | null>;
//# sourceMappingURL=fresh-occupant-relation.d.ts.map