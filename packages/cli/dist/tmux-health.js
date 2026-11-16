function errorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
export function isTmuxNoServerMessage(message) {
    const normalized = message.toLowerCase();
    return normalized.includes("no server running")
        || normalized.includes("failed to connect to server")
        || (normalized.includes("error connecting to") && normalized.includes("no such file or directory"));
}
export function buildTmuxControlFailure(message) {
    return {
        message: "tmux installed, but the default control socket is unhealthy.",
        reason: `OpenRig uses tmux control commands to launch, inspect, and manage agent sessions. The default tmux socket is returning: ${message}`,
        fix: "Capture any needed state from visible tmux panes, then restart the default tmux server before retrying OpenRig. If this happened after a machine restore, treat it as attention required rather than a healthy running state.",
    };
}
export function probeTmuxControl(exec) {
    let version;
    try {
        version = exec("tmux -V").trim();
    }
    catch (err) {
        return {
            installed: false,
            available: false,
            version: null,
            detail: errorMessage(err),
            code: "not_installed",
        };
    }
    try {
        exec("tmux list-sessions");
        return {
            installed: true,
            available: true,
            version,
            detail: null,
            code: "available",
        };
    }
    catch (err) {
        const detail = errorMessage(err).trim();
        if (isTmuxNoServerMessage(detail)) {
            return {
                installed: true,
                available: true,
                version,
                detail,
                code: "no_server",
            };
        }
        return {
            installed: true,
            available: false,
            version,
            detail,
            code: "unhealthy",
        };
    }
}
export async function probeTmuxControlAsync(exec) {
    let version;
    try {
        version = (await exec("tmux -V")).trim();
    }
    catch (err) {
        return {
            installed: false,
            available: false,
            version: null,
            detail: errorMessage(err),
            code: "not_installed",
        };
    }
    try {
        await exec("tmux list-sessions");
        return {
            installed: true,
            available: true,
            version,
            detail: null,
            code: "available",
        };
    }
    catch (err) {
        const detail = errorMessage(err).trim();
        if (isTmuxNoServerMessage(detail)) {
            return {
                installed: true,
                available: true,
                version,
                detail,
                code: "no_server",
            };
        }
        return {
            installed: true,
            available: false,
            version,
            detail,
            code: "unhealthy",
        };
    }
}
//# sourceMappingURL=tmux-health.js.map