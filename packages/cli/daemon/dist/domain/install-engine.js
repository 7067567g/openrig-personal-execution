import path from "node:path";
import { createHash } from "node:crypto";
const BLOCK_START = (name) => `<!-- BEGIN OpenRig MANAGED BLOCK: ${name} -->`;
const BLOCK_END = (name) => `<!-- END OpenRig MANAGED BLOCK: ${name} -->`;
function hashContent(content) {
    return createHash("sha256").update(content).digest("hex");
}
export class InstallEngine {
    installRepo;
    fs;
    constructor(installRepo, fs) {
        this.installRepo = installRepo;
        this.fs = fs;
    }
    apply(policyResult, plan, packageId, targetRoot, bootstrapId) {
        const install = this.installRepo.createInstall(packageId, targetRoot, "project_shared", bootstrapId);
        const applied = [];
        const backupRoot = path.join(targetRoot, ".rigged-backups", install.id);
        try {
            for (const entry of policyResult.approved) {
                // Ensure target directory
                this.fs.mkdirp(path.dirname(entry.targetPath));
                // Backup existing file if it exists
                let backupPath;
                let beforeHash;
                if (this.fs.exists(entry.targetPath)) {
                    const relativePath = path.relative(targetRoot, entry.targetPath);
                    backupPath = path.join(backupRoot, relativePath);
                    this.fs.mkdirp(path.dirname(backupPath));
                    this.fs.copyFile(entry.targetPath, backupPath);
                    beforeHash = hashContent(this.fs.readFile(entry.targetPath));
                }
                // Apply — guidance always uses managed-block merge (even for new files)
                if (entry.exportType === "guidance") {
                    this.applyGuidanceMerge(entry, plan.packageName);
                }
                else if (entry.sourcePath) {
                    // Copy source to target (skills, agents)
                    this.fs.copyFile(entry.sourcePath, entry.targetPath);
                }
                const afterHash = this.fs.exists(entry.targetPath)
                    ? hashContent(this.fs.readFile(entry.targetPath))
                    : undefined;
                try {
                    const journal = this.installRepo.createJournalEntry({
                        installId: install.id,
                        action: entry.classification === "managed_merge" ? "merge_block" : "copy",
                        exportType: entry.exportType,
                        classification: entry.classification,
                        targetPath: entry.targetPath,
                        backupPath,
                        beforeHash,
                        afterHash,
                        status: "applied",
                    });
                    applied.push(journal);
                }
                catch (journalErr) {
                    // Undo this entry's file mutation since it won't be in the rollback list
                    try {
                        if (backupPath && this.fs.exists(backupPath)) {
                            this.fs.copyFile(backupPath, entry.targetPath);
                        }
                        else if (this.fs.exists(entry.targetPath)) {
                            this.fs.deleteFile(entry.targetPath);
                        }
                    }
                    catch { /* best-effort undo */ }
                    throw journalErr;
                }
            }
            this.installRepo.updateInstallStatus(install.id, "applied");
        }
        catch (err) {
            // Compensating rollback on failure
            this.rollbackEntries(install.id, applied);
            this.installRepo.updateInstallStatus(install.id, "failed");
            throw err;
        }
        return {
            installId: install.id,
            applied,
            deferred: plan.deferred,
            conflicts: plan.conflicts,
        };
    }
    rollback(installId) {
        const entries = this.installRepo.getJournalEntries(installId);
        const applyEntries = entries.filter((e) => e.action !== "rollback");
        const { restored, deleted } = this.rollbackEntries(installId, applyEntries);
        this.installRepo.updateInstallStatus(installId, "rolled_back");
        return { installId, restored, deleted };
    }
    rollbackEntries(installId, entries) {
        const restored = [];
        const deleted = [];
        // Reverse order for rollback
        for (const entry of [...entries].reverse()) {
            try {
                if (entry.backupPath && this.fs.exists(entry.backupPath)) {
                    // Restore from backup
                    this.fs.mkdirp(path.dirname(entry.targetPath));
                    this.fs.copyFile(entry.backupPath, entry.targetPath);
                    restored.push(entry.targetPath);
                }
                else if (this.fs.exists(entry.targetPath)) {
                    // No backup = new file, delete it
                    this.fs.deleteFile(entry.targetPath);
                    deleted.push(entry.targetPath);
                }
                // Journal the rollback action
                this.installRepo.createJournalEntry({
                    installId,
                    action: "rollback",
                    exportType: entry.exportType,
                    classification: entry.classification,
                    targetPath: entry.targetPath,
                    status: "rolled_back",
                });
            }
            catch {
                // Best-effort rollback — continue with remaining entries
            }
        }
        return { restored, deleted };
    }
    applyGuidanceMerge(entry, packageName) {
        if (!entry.sourcePath)
            return;
        const content = this.fs.readFile(entry.sourcePath);
        const block = `${BLOCK_START(packageName)}\n${content}\n${BLOCK_END(packageName)}`;
        if (this.fs.exists(entry.targetPath)) {
            const existing = this.fs.readFile(entry.targetPath);
            const startMarker = BLOCK_START(packageName);
            const endMarker = BLOCK_END(packageName);
            const legacyStart = `<!-- BEGIN RIGGED MANAGED BLOCK: ${packageName} -->`;
            const legacyEnd = `<!-- END RIGGED MANAGED BLOCK: ${packageName} -->`;
            // Prefer the OpenRig form; fall back to legacy markers from
            // prior installs so re-applying a guidance package over a
            // pre-rename file replaces the old block instead of appending a
            // duplicate.
            let startIdx = existing.indexOf(startMarker);
            let endIdx = existing.indexOf(endMarker, startIdx + startMarker.length);
            let matchedEndLength = endMarker.length;
            if (startIdx === -1 || endIdx === -1) {
                const legacyStartIdx = existing.indexOf(legacyStart);
                const legacyEndIdx = existing.indexOf(legacyEnd, legacyStartIdx + legacyStart.length);
                if (legacyStartIdx !== -1 && legacyEndIdx !== -1) {
                    startIdx = legacyStartIdx;
                    endIdx = legacyEndIdx;
                    matchedEndLength = legacyEnd.length;
                }
            }
            if (startIdx !== -1 && endIdx !== -1) {
                // Update existing block (rewrites legacy markers to OpenRig form).
                const updated = existing.slice(0, startIdx) + block + existing.slice(endIdx + matchedEndLength);
                this.fs.writeFile(entry.targetPath, updated);
            }
            else {
                // Insert new block at end
                this.fs.writeFile(entry.targetPath, existing + "\n\n" + block + "\n");
            }
        }
        else {
            // New file
            this.fs.writeFile(entry.targetPath, block + "\n");
        }
    }
}
//# sourceMappingURL=install-engine.js.map