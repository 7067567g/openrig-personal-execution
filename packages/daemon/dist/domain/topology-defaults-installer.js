import * as fs from "node:fs";
import * as nodePath from "node:path";
const realFsOps = {
    exists: (p) => fs.existsSync(p),
    isDirectory: (p) => { try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    } },
    listFiles: (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name),
    listDirs: (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name),
    read: (p) => fs.readFileSync(p, "utf-8"),
    write: (p, c) => fs.writeFileSync(p, c, "utf-8"),
    mkdirp: (d) => { fs.mkdirSync(d, { recursive: true }); },
};
export function installTopologyDefaults(input) {
    const ops = input.fsOps ?? realFsOps;
    const result = { installed: [], preserved: [], failed: [], none: false };
    const topologyDir = nodePath.join(input.specDir, "topology");
    const ensureDir = (dir) => {
        try {
            ops.mkdirp(dir);
        }
        catch (err) {
            result.failed.push({ path: dir, error: err instanceof Error ? err.message : String(err) });
        }
    };
    // S7: these directories are the engine's projection of live topology, not
    // authored defaults. Create them on every materialization, including specs
    // with no topology/ source folder at all.
    ensureDir(input.topologyRoot);
    ensureDir(nodePath.join(input.topologyRoot, "rigs", input.rigName));
    for (const podId of input.podIds ?? []) {
        ensureDir(nodePath.join(input.topologyRoot, "rigs", input.rigName, "pods", podId));
    }
    // r2 residual: the total never-throw contract has no first-line exception —
    // even the root probe failing is a NAMED failure, not a throw and not `none`.
    try {
        if (!ops.isDirectory(topologyDir)) {
            result.none = true;
            return result;
        }
    }
    catch (err) {
        result.failed.push({ path: topologyDir, error: err instanceof Error ? err.message : String(err) });
        return result;
    }
    const copyIfAbsent = (src, dest) => {
        try {
            if (ops.exists(dest)) {
                result.preserved.push(dest);
                return;
            }
            const content = ops.read(src);
            ops.mkdirp(nodePath.dirname(dest));
            ops.write(dest, content);
            result.installed.push(dest);
        }
        catch (err) {
            result.failed.push({ path: dest, error: err instanceof Error ? err.message : String(err) });
        }
    };
    // r2-B2: the best-effort contract is TOTAL — enumeration failures (listFiles/
    // listDirs EACCES/EIO) are NAMED failures on the section directory, never a
    // throw, and one section's denial never starves the others. The original had
    // the for-headers outside the catch, so a directory-permission failure
    // escaped AFTER the persistence tx and turned a committed materialize into
    // materialize_error.
    const section = (dir, body) => {
        try {
            body();
        }
        catch (err) {
            result.failed.push({ path: dir, error: err instanceof Error ? err.message : String(err) });
        }
    };
    const instanceDir = nodePath.join(topologyDir, "instance");
    section(instanceDir, () => {
        if (!ops.isDirectory(instanceDir))
            return;
        for (const name of ops.listFiles(instanceDir)) {
            copyIfAbsent(nodePath.join(instanceDir, name), nodePath.join(input.topologyRoot, name));
        }
    });
    const rigDir = nodePath.join(topologyDir, "rig");
    section(rigDir, () => {
        if (!ops.isDirectory(rigDir))
            return;
        for (const name of ops.listFiles(rigDir)) {
            copyIfAbsent(nodePath.join(rigDir, name), nodePath.join(input.topologyRoot, "rigs", input.rigName, name));
        }
    });
    const podsDir = nodePath.join(topologyDir, "pods");
    for (const podId of input.podIds ?? []) {
        const podDir = nodePath.join(podsDir, podId);
        section(podDir, () => {
            if (!ops.isDirectory(podDir))
                return;
            for (const name of ops.listFiles(podDir)) {
                copyIfAbsent(nodePath.join(podDir, name), nodePath.join(input.topologyRoot, "rigs", input.rigName, "pods", podId, name));
            }
        });
    }
    const seatsDir = nodePath.join(topologyDir, "seats");
    section(seatsDir, () => {
        if (!ops.isDirectory(seatsDir))
            return;
        for (const seat of ops.listDirs(seatsDir)) {
            section(nodePath.join(seatsDir, seat), () => {
                for (const name of ops.listFiles(nodePath.join(seatsDir, seat))) {
                    copyIfAbsent(nodePath.join(seatsDir, seat, name), nodePath.join(input.topologyRoot, "rigs", input.rigName, "seats", seat, name));
                }
            });
        }
    });
    return result;
}
//# sourceMappingURL=topology-defaults-installer.js.map