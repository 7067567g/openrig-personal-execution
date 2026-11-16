import { shellQuote } from "../adapters/shell-quote.js";
const DEFAULT_TIMEOUT_MS = 10_000;
/**
 * Provider-backed probe registry for CLI tools and system packages.
 * Uses injected ExecFn — no real shell execution in tests.
 */
export class RequirementsProbeRegistry {
    exec;
    timeoutMs;
    platform;
    constructor(exec, opts) {
        this.exec = exec;
        this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.platform = opts?.platform ?? process.platform;
    }
    /**
     * Probe a CLI tool via `command -v`.
     * Returns the resolved binary path in detectedPath, version stays null.
     */
    async probeCli(name) {
        const cmd = `command -v ${shellQuote(name)}`;
        try {
            const stdout = await this.execWithTimeout(cmd);
            const detectedPath = stdout.trim() || null;
            return {
                name,
                kind: "cli_tool",
                status: detectedPath ? "installed" : "missing",
                version: null,
                detectedPath,
                provider: null,
                command: cmd,
                installHints: null,
                error: null,
            };
        }
        catch (err) {
            const msg = err.message ?? "";
            if (msg.includes("timed out")) {
                return {
                    name, kind: "cli_tool", status: "unknown", version: null,
                    detectedPath: null, provider: null, command: cmd,
                    installHints: null, error: "probe timed out",
                };
            }
            // Only treat "not found" / exit-code errors as genuinely missing.
            // Other errors (EACCES, etc) are unknown — must not become auto_approvable.
            if (msg.includes("not found") || msg.includes("No such") || msg.includes("exit code")) {
                return {
                    name, kind: "cli_tool", status: "missing", version: null,
                    detectedPath: null, provider: null, command: cmd,
                    installHints: null, error: null,
                };
            }
            return {
                name, kind: "cli_tool", status: "unknown", version: null,
                detectedPath: null, provider: null, command: cmd,
                installHints: null, error: msg,
            };
        }
    }
    /**
     * Probe a system package via Homebrew (`brew list --versions`).
     * Parses version from output when available.
     */
    async probeBrew(name) {
        const cmd = `brew list --versions ${shellQuote(name)}`;
        try {
            const stdout = await this.execWithTimeout(cmd);
            const trimmed = stdout.trim();
            // brew list --versions outputs: "name 1.2.3" or "name 1.2.3 1.2.4"
            const parts = trimmed.split(/\s+/);
            const version = parts.length > 1 ? parts[parts.length - 1] : null;
            return {
                name,
                kind: "system_package",
                status: "installed",
                version,
                detectedPath: null,
                provider: "homebrew",
                command: cmd,
                installHints: null,
                error: null,
            };
        }
        catch (err) {
            const msg = err.message ?? "";
            if (msg.includes("timed out")) {
                return {
                    name, kind: "system_package", status: "unknown", version: null,
                    detectedPath: null, provider: "homebrew", command: cmd,
                    installHints: null, error: "probe timed out",
                };
            }
            if (msg.includes("No such keg") || msg.includes("not found") || msg.includes("exit code")) {
                return {
                    name, kind: "system_package", status: "missing", version: null,
                    detectedPath: null, provider: "homebrew", command: cmd,
                    installHints: null, error: null,
                };
            }
            return {
                name, kind: "system_package", status: "unknown", version: null,
                detectedPath: null, provider: "homebrew", command: cmd,
                installHints: null, error: msg,
            };
        }
    }
    /**
     * Probe a single requirement. Routes to the appropriate provider.
     * Preserves installHints from the spec onto the result.
     */
    async probeRequirement(spec) {
        let result;
        if (spec.kind === "cli_tool") {
            result = await this.probeCli(spec.name);
        }
        else if (spec.kind === "system_package") {
            if (this.platform !== "darwin") {
                result = {
                    name: spec.name,
                    kind: "system_package",
                    status: "unsupported",
                    version: null,
                    detectedPath: null,
                    provider: null,
                    command: null,
                    installHints: null,
                    error: null,
                };
            }
            else {
                result = await this.probeBrew(spec.name);
            }
        }
        else {
            result = {
                name: spec.name,
                kind: spec.kind,
                status: "unsupported",
                version: null,
                detectedPath: null,
                provider: null,
                command: null,
                installHints: null,
                error: null,
            };
        }
        // Preserve installHints from spec — display only, never executed
        if (spec.installHints) {
            result.installHints = spec.installHints;
        }
        return result;
    }
    /**
     * Probe all requirements in sequence. Returns results in input order.
     */
    async probeAll(specs) {
        const results = [];
        for (const spec of specs) {
            results.push(await this.probeRequirement(spec));
        }
        return results;
    }
    async execWithTimeout(cmd) {
        return Promise.race([
            this.exec(cmd),
            new Promise((_, reject) => setTimeout(() => reject(new Error("probe timed out")), this.timeoutMs)),
        ]);
    }
}
//# sourceMappingURL=requirements-probe.js.map