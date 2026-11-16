import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * Read the CLI's own package.json version at call time (Item 1 / slice-05).
 * Function-level read on purpose: module-level constants would mask test
 * isolation per the audit-every-layer discipline.
 */
export declare function getCliVersion(): string;
/** Keep the daemon's messages readable in human output; JSON retains the original body. */
export declare function bundleInstallError(data: Record<string, unknown>, includeWarnings?: boolean): string;
export declare function bundleCommand(depsOverride?: StatusDeps): Command;
/** Render the daemon's reason verbatim, including continuation guidance when available. */
export declare function startupAttentionSummary(data: Record<string, unknown>): string[];
/** One line per routed kind: what landed, and each declared entry that did not. */
export declare function bundleRoutingSummary(data: Record<string, unknown>): string[];
//# sourceMappingURL=bundle.d.ts.map