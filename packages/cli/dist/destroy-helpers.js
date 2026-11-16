import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
export const DESTROY_CONFIRM_TOKEN = "destroy-openrig-state";
function normalizePathForPrefix(path) {
    return path.endsWith("/") ? path : `${path}/`;
}
export function isWithinPath(candidate, root) {
    if (candidate === root)
        return true;
    return candidate.startsWith(normalizePathForPrefix(root));
}
function formatTimestamp(date) {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}
export function buildBackupPath(targetPath, exists, now = new Date()) {
    const stamp = formatTimestamp(now);
    const base = `${targetPath}.backup-${stamp}`;
    if (!exists(base))
        return base;
    let suffix = 2;
    while (exists(`${base}-${suffix}`))
        suffix += 1;
    return `${base}-${suffix}`;
}
export function listManagedTmuxSessionsFromDb(dbPath) {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
        const rows = db.prepare(`
      SELECT DISTINCT
        COALESCE(
          b.tmux_session,
          (
            SELECT s2.session_name
            FROM sessions s2
            WHERE s2.node_id = n.id
            ORDER BY datetime(s2.created_at) DESC, s2.rowid DESC
            LIMIT 1
          )
        ) AS session_name
      FROM nodes n
      LEFT JOIN bindings b ON b.node_id = n.id
      WHERE COALESCE(b.attachment_type, 'tmux') = 'tmux'
    `).all();
        return rows
            .map((row) => row.session_name?.trim() ?? "")
            .filter((name) => Boolean(name))
            .sort();
    }
    finally {
        db.close();
    }
}
export function buildDestroyPlan(scope, backup, config, deps) {
    const warnings = [];
    const targets = [];
    const stateRootExists = deps.exists(config.stateRoot);
    targets.push({
        path: config.stateRoot,
        kind: "state_root",
        ...(backup && stateRootExists ? { backupPath: buildBackupPath(config.stateRoot, deps.exists, deps.now()) } : {}),
    });
    const addExternalTarget = (path, kind) => {
        if (!deps.exists(path))
            return;
        if (isWithinPath(path, config.stateRoot))
            return;
        targets.push({
            path,
            kind,
            ...(backup ? { backupPath: buildBackupPath(path, deps.exists, deps.now()) } : {}),
        });
        warnings.push(`${kind} is outside state root and will be ${backup ? "backed up separately" : "deleted separately"}: ${path}`);
    };
    addExternalTarget(config.dbPath, "db_file");
    addExternalTarget(`${config.dbPath}-shm`, "db_shm");
    addExternalTarget(`${config.dbPath}-wal`, "db_wal");
    addExternalTarget(config.transcriptsPath, "transcripts_dir");
    let managedTmuxSessions = [];
    if (scope === "all" && deps.exists(config.dbPath)) {
        try {
            managedTmuxSessions = deps.listManagedTmuxSessions(config.dbPath);
        }
        catch (err) {
            warnings.push(`Failed to enumerate managed tmux sessions from ${config.dbPath}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return {
        scope,
        backup,
        stateRoot: config.stateRoot,
        daemonHost: config.daemonHost,
        daemonPort: config.daemonPort,
        managedTmuxSessions,
        targets,
        warnings,
    };
}
function isLocalHost(host) {
    return host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0";
}
export async function executeDestroy(plan, deps) {
    const warnings = [...plan.warnings];
    const backupPaths = [];
    let stateRecreated = false;
    try {
        await deps.stopDaemon();
    }
    catch (err) {
        warnings.push(`stopDaemon failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    let daemonStopped = false;
    let portCleared = false;
    if (isLocalHost(plan.daemonHost)) {
        const before = await deps.inspectListener(plan.daemonHost, plan.daemonPort);
        if (before.kind === "openrig") {
            const listenerPid = deps.findListeningPid(plan.daemonPort);
            if (listenerPid !== null) {
                try {
                    deps.killProcess(listenerPid);
                }
                catch (err) {
                    warnings.push(`Failed to terminate listener pid ${listenerPid}: ${err instanceof Error ? err.message : String(err)}`);
                }
                for (let attempt = 0; attempt < 20; attempt += 1) {
                    if ((await deps.inspectListener(plan.daemonHost, plan.daemonPort)).kind === "unreachable")
                        break;
                    await deps.sleep(100);
                }
            }
            else {
                warnings.push(`OpenRig responded on port ${plan.daemonPort}, but no listener pid was found.`);
            }
        }
        else if (before.kind === "other_http") {
            warnings.push(`Port ${plan.daemonPort} is occupied by a live non-OpenRig HTTP listener. State was left untouched.`);
        }
        const after = await deps.inspectListener(plan.daemonHost, plan.daemonPort);
        portCleared = after.kind === "unreachable";
        daemonStopped = portCleared;
    }
    else {
        warnings.push(`Daemon host ${plan.daemonHost} is not local. rig destroy only operates on local daemon targets; state was left untouched.`);
    }
    if (!portCleared) {
        return {
            scope: plan.scope,
            backup: plan.backup,
            stateRoot: plan.stateRoot,
            backupPaths,
            daemonStopped,
            portCleared,
            stateRecreated,
            tmuxKilled: 0,
            tmuxMissing: 0,
            warnings,
        };
    }
    let tmuxKilled = 0;
    let tmuxMissing = 0;
    if (plan.scope === "all") {
        for (const sessionName of plan.managedTmuxSessions) {
            if (deps.killTmuxSession(sessionName))
                tmuxKilled += 1;
            else
                tmuxMissing += 1;
        }
    }
    for (const target of plan.targets) {
        if (!deps.exists(target.path))
            continue;
        if (plan.backup && target.backupPath) {
            deps.renamePath(target.path, target.backupPath);
            backupPaths.push(target.backupPath);
        }
        else {
            deps.removePath(target.path);
        }
    }
    deps.mkdirp(plan.stateRoot);
    stateRecreated = true;
    return {
        scope: plan.scope,
        backup: plan.backup,
        stateRoot: plan.stateRoot,
        backupPaths,
        daemonStopped,
        portCleared,
        stateRecreated,
        tmuxKilled,
        tmuxMissing,
        warnings,
    };
}
export function findListeningPidWithLsof(port) {
    try {
        const output = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf-8" }).trim();
        if (!output)
            return null;
        const first = output.split(/\s+/)[0]?.trim();
        if (!first)
            return null;
        const pid = parseInt(first, 10);
        return Number.isNaN(pid) ? null : pid;
    }
    catch {
        return null;
    }
}
export function killTmuxSessionWithCli(sessionName) {
    try {
        execFileSync("tmux", ["kill-session", "-t", sessionName], { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=destroy-helpers.js.map