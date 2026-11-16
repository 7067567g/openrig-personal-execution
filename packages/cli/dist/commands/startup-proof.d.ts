import { Command } from "commander";
export interface StartupProofDeps {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    readFile?: (path: string) => string;
}
export interface StartupProofSubmitResult {
    ok: true;
    oriented: "verified";
    nodeId: string;
    challengeId: string;
}
interface Endpoint {
    baseUrl: string;
    token: string;
}
export declare function resolveStartupProofEndpoint(deps?: StartupProofDeps): Endpoint | null;
export declare function submitStartupProof(input: {
    challengeId: string;
    answer: string;
}, deps?: StartupProofDeps): Promise<StartupProofSubmitResult>;
export declare function startupProofCommand(depsOverride?: StartupProofDeps): Command;
export {};
//# sourceMappingURL=startup-proof.d.ts.map