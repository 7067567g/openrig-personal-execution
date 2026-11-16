export class CmuxAdapter {
    factory;
    options;
    status = { available: false, capabilities: {} };
    transport = null;
    constructor(factory, options) {
        this.factory = factory;
        this.options = options;
    }
    async connect() {
        // Clean up previous transport if any
        if (this.transport) {
            try {
                this.transport.close();
            }
            catch {
                // Ignore close errors
            }
            this.transport = null;
        }
        // Track transient transport so we can clean it up if connect fails
        // after the factory succeeds (e.g. capabilities hang or throw).
        // Using an object wrapper because TS control flow doesn't track
        // mutations inside async closures for simple let bindings.
        const holder = { transport: null };
        try {
            const { transport, capabilities } = await withTimeout((async () => {
                holder.transport = await this.factory();
                const result = await holder.transport.request("capabilities");
                const caps = normalizeCapabilities(result);
                await holder.transport.request("workspace.current");
                return { transport: holder.transport, capabilities: caps };
            })(), this.options.timeoutMs);
            this.transport = transport;
            this.status = { available: true, capabilities };
        }
        catch {
            // Clean up transient transport if factory succeeded but we're failing
            if (holder.transport) {
                try {
                    holder.transport.close();
                }
                catch {
                    // Ignore close errors
                }
            }
            this.transport = null;
            this.status = { available: false, capabilities: {} };
        }
    }
    getStatus() {
        return this.status;
    }
    isAvailable() {
        return this.status.available;
    }
    async listWorkspaces() {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const result = (await this.transport.request("workspace.list"));
            return { ok: true, data: result.workspaces ?? [] };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async listSurfaces(workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const params = workspaceId != null ? { workspaceId } : undefined;
            const result = (await this.transport.request("surface.list", params));
            return { ok: true, data: result.surfaces ?? [] };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async focusSurface(surfaceId, workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            await this.transport.request("surface.focus", { surfaceId, workspaceId });
            return { ok: true, data: undefined };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async sendText(surfaceId, text, workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            await this.transport.request("surface.sendText", { surfaceId, text, workspaceId });
            return { ok: true, data: undefined };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async currentWorkspace() {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const raw = (await this.transport.request("workspace.current"));
            const handle = normalizeHandle("workspace", raw["workspace_id"] ?? raw["id"]);
            if (!handle) {
                return { ok: false, code: "request_failed", message: "cmux current-workspace returned no workspace handle" };
            }
            return { ok: true, data: handle };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async createTerminalSurface(workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const raw = (await this.transport.request("surface.create", { workspaceId, type: "terminal" }));
            const handle = [
                raw["created_surface_ref"],
                raw["created_surface_id"],
                raw["surface_ref"],
                raw["surface_id"],
                raw["id"],
            ]
                .map((value) => normalizeHandle("surface", value))
                .find((value) => Boolean(value));
            if (!handle) {
                return { ok: false, code: "request_failed", message: "cmux new-surface returned no surface handle" };
            }
            return { ok: true, data: handle };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    // Slice 24 layout primitives — see slice 24 pre-scaffold spike result.
    // cmux RPC accepts these methods with snake_case params (verified via
    // `cmux rpc workspace.close` probe). New methods adopt snake_case
    // explicitly; existing camelCase callers (sendText, focus, etc.) are
    // unchanged at this checkpoint.
    async splitSurface(surfaceId, direction, workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const params = {
                surface_id: surfaceId,
                direction,
            };
            if (workspaceId != null)
                params["workspace_id"] = workspaceId;
            const raw = (await this.transport.request("surface.split", params));
            const handle = [
                raw["created_surface_ref"],
                raw["created_surface_id"],
                raw["surface_ref"],
                raw["surface_id"],
                raw["id"],
            ]
                .map((value) => normalizeHandle("surface", value))
                .find((value) => Boolean(value));
            if (!handle) {
                return { ok: false, code: "request_failed", message: "cmux surface.split returned no surface handle" };
            }
            return { ok: true, data: handle };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    /**
     * `equalized` echoes cmux's own verdict: true = frames were rebalanced,
     * false = cmux made no change (nothing to equalize, or the workspace was
     * still settling). Callers MUST read it — a discarded false is exactly the
     * silent 2:1:1 grid the VM diagnostic caught.
     */
    async equalizeSplits(workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const params = {};
            if (workspaceId != null)
                params["workspace_id"] = workspaceId;
            const raw = (await this.transport.request("workspace.equalize_splits", params));
            return { ok: true, data: { equalized: raw["equalized"] === true } };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async createWorkspace(name, cwd) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const params = { title: name };
            if (cwd != null)
                params["cwd"] = cwd;
            const raw = (await this.transport.request("workspace.create", params));
            const handle = [
                raw["workspace_ref"],
                raw["workspace_id"],
                raw["id"],
            ]
                .map((value) => normalizeHandle("workspace", value))
                .find((value) => Boolean(value));
            if (!handle) {
                return { ok: false, code: "request_failed", message: "cmux workspace.create returned no workspace handle" };
            }
            return { ok: true, data: handle };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async closeWorkspace(workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            await this.transport.request("workspace.close", { workspace_id: workspaceId });
            return { ok: true, data: undefined };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    async listPaneSurfaces(paneId, workspaceId) {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const params = { pane_id: paneId };
            if (workspaceId != null)
                params["workspace_id"] = workspaceId;
            const result = (await this.transport.request("pane.surfaces", params));
            return { ok: true, data: result.surfaces ?? [] };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
    /** Query cmux for agent PIDs (sidebar metadata). Returns Map<pid, { runtime, pid }>. */
    async queryAgentPIDs() {
        if (!this.transport) {
            return { ok: false, code: "unavailable", message: "cmux is not connected" };
        }
        try {
            const result = (await this.transport.request("workspace.agentPIDs"));
            const map = new Map();
            if (result.agents) {
                for (const agent of result.agents) {
                    map.set(agent.pid, { runtime: agent.runtime, pid: agent.pid });
                }
            }
            return { ok: true, data: map };
        }
        catch (err) {
            return { ok: false, code: "request_failed", message: err instanceof Error ? err.message : String(err) };
        }
    }
}
function normalizeCapabilities(raw) {
    const caps = {};
    if (Array.isArray(raw)) {
        for (const cap of raw) {
            if (typeof cap === "string" && cap.trim() !== "") {
                caps[cap] = true;
            }
        }
        return caps;
    }
    if (!raw || typeof raw !== "object") {
        return caps;
    }
    const record = raw;
    const nested = record["capabilities"];
    if (Array.isArray(nested)) {
        for (const cap of nested) {
            if (typeof cap === "string" && cap.trim() !== "") {
                caps[cap] = true;
            }
        }
        return caps;
    }
    for (const [key, value] of Object.entries(record)) {
        if (value === false || value == null)
            continue;
        caps[key] = true;
    }
    return caps;
}
function normalizeHandle(kind, value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const refPattern = kind === "workspace" ? /(workspace:[^\s]+)/ : /(surface:[^\s]+)/;
    const refMatch = trimmed.match(refPattern);
    if (refMatch)
        return refMatch[1];
    const withoutOK = trimmed.replace(/^OK\s+/, "");
    const firstToken = withoutOK.split(/\s+/)[0];
    return firstToken || undefined;
}
function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Connection timed out after ${ms}ms`));
        }, ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
//# sourceMappingURL=cmux.js.map