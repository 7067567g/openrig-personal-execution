import fs from "node:fs";
import path from "node:path";
import { describeBundleBehaviour } from "./bundle-behaviour.js";
/** Called only for the private directory produced by the existing archive inspection. */
export function inspectBundleBehaviour(archiveRoot, input) {
    const files = new Map();
    const omittedFiles = [];
    // Description is diagnostic, so oversized/binary files are unknown, not a new install refusal.
    let remainingBytes = 8 * 1024 * 1024;
    const walk = (directory, prefix) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(absolute, relative);
                continue;
            }
            if (!entry.isFile()) {
                omittedFiles.push(relative);
                continue;
            }
            let fd;
            try {
                fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
                const stat = fs.fstatSync(fd);
                if (!stat.isFile() || stat.size > 1024 * 1024 || stat.size > remainingBytes) {
                    omittedFiles.push(relative);
                    continue;
                }
                const bytes = fs.readFileSync(fd);
                if (bytes.includes(0)) {
                    omittedFiles.push(relative);
                    continue;
                }
                const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                remainingBytes -= bytes.byteLength;
                files.set(relative, content);
            }
            catch {
                omittedFiles.push(relative);
            }
            finally {
                if (fd !== undefined)
                    fs.closeSync(fd);
            }
        }
    };
    try {
        walk(archiveRoot, "");
    }
    catch {
        omittedFiles.push("<unread archive members>");
    }
    return describeBundleBehaviour({ ...input, files, omittedFiles });
}
//# sourceMappingURL=bundle-behaviour-inspect.js.map