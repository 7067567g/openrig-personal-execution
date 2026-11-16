import { Hono } from "hono";
import { resolveAllowedPath, type AllowlistRoot } from "../domain/files/path-safety.js";
import { type FileWriteService } from "../domain/files/file-write-service.js";
export interface FilesRoutesDeps {
    /** Allowlist resolved at startup; empty array = no roots configured. */
    allowlist: AllowlistRoot[];
    /** Atomic-write service; absent → POST /write returns 503 unconfigured. */
    writeService: FileWriteService | null;
}
/** Operator Surface Reconciliation v0 item 5: file-read truncation
 *  cap. PRD § Item 5 picks 1 MB. The dashboard
 *  precedent was 200 KB; the v0 ceiling is 1 MB so the operator can
 *  read most workspace canon files in full. */
export { FILE_READ_TRUNCATION_BYTES } from "../domain/files/file-read.js";
export declare function filesRoutes(): Hono;
export { resolveAllowedPath };
//# sourceMappingURL=files.d.ts.map