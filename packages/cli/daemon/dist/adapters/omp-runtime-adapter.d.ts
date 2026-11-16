import { PiRuntimeAdapter } from "./pi-runtime-adapter.js";
/** OMP shares the Pi runner and seat-sidecar protocol, but selects OMP's own
 * CLI, isolated state root, approval semantics, and resume-token type. */
export declare class OmpRuntimeAdapter extends PiRuntimeAdapter {
    readonly runtime: "omp";
    /** project() writes skills into the seat agent dir, which the runner pins as
     *  OMP's PI_CODING_AGENT_DIR; a Claude copy in a shared cwd is not this seat's. */
    skillTargetPath(tmuxSession: string | null, effectiveId: string): string | null;
}
//# sourceMappingURL=omp-runtime-adapter.d.ts.map