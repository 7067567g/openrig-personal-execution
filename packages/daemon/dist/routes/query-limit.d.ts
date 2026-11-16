import type { Context } from "hono";
/** Parse an optional `?limit=` exactly as these routes always have
 * (`Number.parseInt(limit, 10)`, so `-1`, `0` and `10abc` keep working), and
 * refuse only values that would fail as a 500: NaN, and, where the value is
 * bound straight into SQL, a magnitude SQLite cannot bind. Absent or empty
 * keeps the route's default. `used: false` is for a request that never binds
 * the limit (it returns early, or the query has its own), so any value answers
 * as it always has. */
export declare function queryLimit(c: Context, opts?: {
    boundIntoSql?: boolean;
    used?: boolean;
}): {
    ok: true;
    limit: number | undefined;
} | {
    ok: false;
    response: Response;
};
//# sourceMappingURL=query-limit.d.ts.map