import { Command } from "commander";
import { type DoctorDeps } from "./doctor.js";
export interface SetupStep {
    id: string;
    status: "pass" | "applied" | "warn" | "fail" | "skipped";
    message: string;
    reason?: string;
    fixHint?: string;
}
export interface VerificationCheck {
    name: string;
    status: "pass" | "warn" | "fail" | "skipped";
    message: string;
    reason?: string;
    fix?: string;
}
export interface RuntimeConfigDisclosure {
    scope: "global" | "project";
    runtime: "claude-code" | "codex" | "cmux";
    path: string;
    purpose: string;
}
export interface SetupResult {
    profile: "core" | "full";
    platform: string;
    ready: boolean;
    steps: SetupStep[];
    runtimeConfig: RuntimeConfigDisclosure[];
    verification?: {
        checks: VerificationCheck[];
    };
}
export interface SetupDeps {
    exec: (cmd: string, opts?: {
        timeoutMs?: number;
    }) => string;
    readFile: (path: string) => string | null;
    writeFile: (path: string, content: string) => void;
    exists: (path: string) => boolean;
    mkdirp?: (path: string) => void;
    platform?: NodeJS.Platform;
    /** Environment for CODEX_HOME and provider credential checks (default process.env). */
    env?: NodeJS.ProcessEnv;
}
export { selectCodexProviderAuth, type CodexProviderAuth } from "../provider-auth.js";
export declare function defaultDeps(): SetupDeps;
export declare const POLICY_CHOICES: readonly ["locked", "standard", "open", "yolo", "auto", "none"];
export type PolicyChoice = (typeof POLICY_CHOICES)[number];
/**
 * Resolve `specPath` to a readable EXISTING root spec file, or null. Accepts a direct file path or a
 * directory containing a root spec. Uses deps.readFile as the read+existence probe (null = absent), so
 * the resolver stays fs-injectable and never mints a spec — RULING-C: no scaffold-authoring here.
 */
export declare function resolveExistingSpecPath(deps: SetupDeps, specPath: string): string | null;
/**
 * Record a deliberate policy choice into an existing spec, returning the `policy_record` SetupStep.
 * Only called when the operator explicitly passed --policy (P3). Unknown choice or no resolvable
 * existing spec => a `fail` step and NOTHING is written (P1 + RULING-C new-install-writes-nothing).
 */
export declare function recordPermissionPolicyStep(deps: SetupDeps, choice: string, specPath: string | undefined): SetupStep;
export type SetupProvider = "claude" | "codex";
/** `--providers`: the person's choice, comma-separated (`claude`, `codex`, `claude,codex` or `both`). */
export declare function parseSetupProviders(value: string): SetupProvider[] | {
    error: string;
};
export declare function runSetup(deps: SetupDeps, opts: {
    dryRun?: boolean;
    full?: boolean;
    policy?: string;
    specPath?: string;
    herdr?: boolean;
    ghostty?: boolean;
    providers?: readonly SetupProvider[];
    doctorDeps?: DoctorDeps;
}): Promise<SetupResult>;
/**
 * OPR.0.3.3.04.2 (AC-1): the ONE canonical ordered golden path over EXISTING
 * verbs - no magic mega-command, no hidden state. `rig setup` prints this as its
 * next-steps; `rig status`/`rig doctor` only HINT back to it; the durable
 * reference is docs/reference/getting-started.md. Returns the lines to print.
 */
export declare function goldenPathNextSteps(): string[];
/**
 * Slice-03 Lane B (OPR.0.4.8) onboarding menu copy. The 0.4.8 lineage has no TUI, so the "menu" is
 * calm-register narrative text presenting the permission-policy choice. Copy is FROZEN + founder-picked
 * (missions/.../MENU-COPY-FROZEN-2026-08-04): verbatim `Policy Mode`/`YOLO Mode` labels, the NAME
 * "Operator" never appears (YOLO Mode is the user-facing label for it), the exact deliberate-none and
 * skip-line phrasing, NO pre-selected default, and `Standard` carries the ⭐ recommendation marker.
 * REGISTER RULE (pm-lead): factual + version-neutral — never "treacherous"/editorializing/
 * founder-internal wording. Recording is a thought, never a gate — `rig up` always works bare.
 * 0.6.7: the question, the deliberate-none line and the skip line now state the team launch default
 * (#893) that ships with 0.6.6, matching docs/reference/getting-started.md and the
 * applying-a-permission-policy skill. The labels, marker and register are unchanged.
 */
export declare function permissionPolicyMenuLines(): string[];
export declare function setupCommand(depsOverride?: SetupDeps): Command;
//# sourceMappingURL=setup.d.ts.map