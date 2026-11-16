import type Database from "better-sqlite3";
export interface ProjectionManifestEntry {
    targetPath: string;
    lastHash: string;
    writtenAt: string;
    sourceSpec: string | null;
    category: string | null;
}
/**
 * P20 — accessors for the projection_manifest. `record` is called ON WRITE (the
 * projector actually wrote content to targetPath); `get` is consulted at
 * classify-time to discriminate stale-projection (target == last_hash → safe
 * overwrite) from operator-modified (target diverges from BOTH last_hash and the
 * new source → protect). Upsert on target_path keeps exactly the LAST write.
 */
export declare class ProjectionManifestStore {
    private readonly db;
    constructor(db: Database.Database);
    record(entry: {
        targetPath: string;
        lastHash: string;
        writtenAt: string;
        sourceSpec?: string | null;
        category?: string | null;
    }): void;
    get(targetPath: string): ProjectionManifestEntry | null;
    /** Convenience for the discrimination rule: the last-written hash, or null. */
    lastHash(targetPath: string): string | null;
    /**
     * atom-4b — a BOOT-time whole-table readability probe, DISTINCT from a per-lookup throw. When the
     * projection_manifest is unreadable (missing / migration-failed / corrupt), EVERY `lastHash` lookup
     * throws → `classifyResourceProjection` returns `operator_conflict` for EVERY divergent projection →
     * a SILENT protect-ALL degrade in which no projection ever applies. That systemic case is a safe
     * degrade (no data loss) but must be VISIBLE: boot calls this probe to warn loudly, so an operator
     * knows projections are held rather than silently discovering none apply. Cheap + NEVER throws.
     */
    isReadable(): boolean;
}
//# sourceMappingURL=projection-manifest-store.d.ts.map