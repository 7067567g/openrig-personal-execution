import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export interface RigModeDeps extends StatusDeps {
}
declare const MODES: readonly ["sleep", "desk", "mobile", "away", "focus", "debug", "human-led", "delegated"];
type Mode = (typeof MODES)[number];
declare const SCOPES: readonly ["global_host", "rig", "project", "mission", "workstream", "qitem"];
type Scope = (typeof SCOPES)[number];
declare function disambiguateModeInvocation(raw: string): Mode | null;
interface BindingResponse {
    binding: {
        id: string;
        mode: Mode;
        record: Record<string, string>;
        qualifier: string | null;
        setAt: string;
        setBy: string;
    };
}
/**
 * Mirror of the daemon route's parseScopeAndQualifier semantics on the
 * CLI side. The CLI is the operator's authoring surface; the convention's
 * scope rule applies at invocation, NOT only at raw HTTP URL parsing.
 *
 * Reject:
 *   - explicit qualifier with global_host (BLOCKING re-verify finding from
 *     guard qitem-20260518044650): operators who type
 *     `--scope global_host --qualifier <id>` get an error and the daemon
 *     is never contacted. The CLI does NOT silently drop the qualifier.
 *   - missing qualifier for any non-global scope.
 */
type NormalizedScope = {
    ok: true;
    qualifier: string | null;
} | {
    ok: false;
    message: string;
};
declare function normalizeScopeQualifier(scope: Scope, explicitQualifier: string | undefined): NormalizedScope;
declare function formatCitation(b: BindingResponse["binding"]): string;
export declare function rigModeCommand(depsOverride?: RigModeDeps): Command;
export declare const __test__: {
    disambiguateModeInvocation: typeof disambiguateModeInvocation;
    formatCitation: typeof formatCitation;
    normalizeScopeQualifier: typeof normalizeScopeQualifier;
};
export {};
//# sourceMappingURL=rig-mode.d.ts.map