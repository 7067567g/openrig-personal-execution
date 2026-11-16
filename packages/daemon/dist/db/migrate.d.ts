import type Database from "better-sqlite3";
export interface Migration {
    name: string;
    sql: string;
}
/**
 * Run migrations against a database.
 * Tracks applied migrations in a schema_migrations table.
 * Skips already-applied migrations. Applies new ones in order.
 */
export declare function migrate(db: Database.Database, migrations: Migration[]): void;
//# sourceMappingURL=migrate.d.ts.map