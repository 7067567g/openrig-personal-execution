/** Shell-quote a string using single quotes (POSIX-safe). */
function sq(s) {
    return "'" + s.replace(/'/g, "'\"'\"'") + "'";
}
function formatExecError(err) {
    if (err instanceof Error) {
        const execErr = err;
        const stdout = typeof execErr.stdout === "string"
            ? execErr.stdout.trim()
            : "";
        const stderr = typeof execErr.stderr === "string"
            ? execErr.stderr.trim()
            : "";
        const details = [stdout, stderr].filter(Boolean).join("\n");
        if (details && !err.message.includes(details)) {
            return `${err.message}\n${details}`;
        }
        return err.message;
    }
    return String(err);
}
// -- Adapter --
/**
 * I/O adapter for Docker Compose. Shells out to `docker compose`.
 * Lives in adapters/ alongside tmux.ts — infrastructure I/O, not domain logic.
 */
export class ComposeServicesAdapter {
    exec;
    constructor(exec) {
        this.exec = exec;
    }
    /** Start services with docker compose up -d. Readiness is handled by services-readiness, not --wait. */
    async up(opts) {
        const args = this.baseArgs(opts.composeFile, opts.projectName, opts.profiles);
        const cmd = `docker compose ${args} up -d 2>&1`;
        try {
            await this.exec(cmd);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, code: "compose_up_failed", message: formatExecError(err) };
        }
    }
    /** Stop services according to down policy. */
    async down(opts) {
        if (opts.policy === "leave_running") {
            return { ok: true }; // intentional no-op
        }
        const args = this.baseArgs(opts.composeFile, opts.projectName, opts.profiles);
        const volumeFlag = opts.policy === "down_and_volumes" ? " --volumes" : "";
        const cmd = `docker compose ${args} down${volumeFlag} 2>&1`;
        try {
            await this.exec(cmd);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, code: "compose_down_failed", message: formatExecError(err) };
        }
    }
    /** Get service statuses via docker compose ps --format json. */
    async status(opts) {
        const args = this.baseArgs(opts.composeFile, opts.projectName, opts.profiles);
        const cmd = `docker compose ${args} ps --format json 2>&1`;
        try {
            const output = await this.exec(cmd);
            const parseInput = this.extractComposePsPayload(output);
            const services = this.parseComposePs(parseInput);
            if (parseInput !== "" && services.length === 0) {
                return { ok: false, services: [], error: "docker compose ps returned unparseable JSON output" };
            }
            return { ok: true, services };
        }
        catch (err) {
            return { ok: false, services: [], error: formatExecError(err) };
        }
    }
    /** Get logs for a specific service or all services. */
    async logs(opts) {
        const args = this.baseArgs(opts.composeFile, opts.projectName, opts.profiles);
        const serviceArg = opts.service ? ` ${sq(opts.service)}` : "";
        const tailArg = Number.isFinite(opts.tail) ? ` --tail ${opts.tail}` : "";
        const cmd = `docker compose ${args} logs${tailArg}${serviceArg} 2>&1`;
        try {
            const output = await this.exec(cmd);
            return { ok: true, output };
        }
        catch (err) {
            return { ok: false, output: "", error: formatExecError(err) };
        }
    }
    /** Run a checkpoint export command. */
    async runCheckpointExport(command) {
        try {
            await this.exec(command);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, code: "checkpoint_export_failed", message: formatExecError(err) };
        }
    }
    /** Run a checkpoint import command. */
    async runCheckpointImport(command) {
        try {
            await this.exec(command);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, code: "checkpoint_import_failed", message: formatExecError(err) };
        }
    }
    /** Probe an HTTP wait target. Any 2xx or 3xx response passes this target;
     * redirects are not followed. This proves the server answered, not application readiness. */
    async probeHttp(url, timeoutMs = 5000) {
        try {
            const cmd = `curl -sf -o /dev/null -w '%{http_code}' --max-time ${Math.ceil(timeoutMs / 1000)} ${sq(url)} 2>/dev/null`;
            const output = await this.exec(cmd);
            const code = parseInt(output.trim(), 10);
            return code >= 200 && code < 400;
        }
        catch {
            return false;
        }
    }
    /** Probe a TCP wait target. Returns true if the port is open. */
    async probeTcp(target, timeoutMs = 5000) {
        try {
            const match = /^(?:\[([^\]]+)\]|([^:]+)):([^:]+)$/.exec(target);
            const host = match?.[1] ?? match?.[2];
            const portStr = match?.[3];
            if (!host || !portStr)
                return false;
            const cmd = `nc -z -w ${Math.ceil(timeoutMs / 1000)} ${sq(host)} ${sq(portStr)} 2>/dev/null`;
            await this.exec(cmd);
            return true;
        }
        catch {
            return false;
        }
    }
    // -- Private helpers --
    baseArgs(composeFile, projectName, profiles) {
        const parts = [`-f ${sq(composeFile)}`, `-p ${sq(projectName)}`];
        if (profiles && profiles.length > 0) {
            for (const p of profiles) {
                parts.push(`--profile ${sq(p)}`);
            }
        }
        return parts.join(" ");
    }
    extractComposePsPayload(output) {
        const trimmed = output.trim();
        if (!trimmed)
            return "";
        if (trimmed.startsWith("{") || trimmed.startsWith("["))
            return trimmed;
        const jsonLines = trimmed
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("{") || line.startsWith("["));
        return jsonLines.join("\n");
    }
    /** Parse docker compose ps --format json. Handles both one-object-per-line and JSON array formats. */
    parseComposePs(output) {
        const trimmed = output.trim();
        if (!trimmed)
            return [];
        // Try JSON array first
        if (trimmed.startsWith("[")) {
            try {
                const arr = JSON.parse(trimmed);
                return arr.map((obj) => this.mapServiceStatus(obj));
            }
            catch { /* fall through to line-by-line */ }
        }
        // One JSON object per line
        const results = [];
        for (const line of trimmed.split("\n")) {
            const l = line.trim();
            if (!l || !l.startsWith("{"))
                continue;
            try {
                const obj = JSON.parse(l);
                results.push(this.mapServiceStatus(obj));
            }
            catch { /* skip malformed lines */ }
        }
        return results;
    }
    mapServiceStatus(obj) {
        return {
            name: String(obj["Service"] ?? obj["Name"] ?? ""),
            state: String(obj["State"] ?? ""),
            status: String(obj["Status"] ?? ""),
            health: typeof obj["Health"] === "string" ? obj["Health"] : null,
        };
    }
}
//# sourceMappingURL=compose-services-adapter.js.map