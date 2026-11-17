// S3: the startup single-node auto-rehydrate lane must preflight the exact
// prepared payload before it persists a snapshot. This mirrors /api/up and
// /api/rigs/:id/up; a structural blocker leaves no auto-rehydrate row behind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFullTestDb, createTestApp } from "../helpers/test-app.js";
import { startupRevision } from "../../src/routes/startup.js";

describe("startup single-node auto-rehydrate preflight", () => {
  let db: ReturnType<typeof createFullTestDb>;
  let setup: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createFullTestDb();
    setup = createTestApp(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
  });

  function pendingSeat() {
    const rig = setup.rigRepo.createRig("auto-rehydrate");
    const node = setup.rigRepo.addNode(rig.id, "dev.worker", { runtime: "claude-code", cwd: "/tmp" });
    db.prepare(
      "INSERT INTO node_startup_context (node_id, projection_entries_json, resolved_files_json, startup_actions_json, runtime) VALUES (?, '[]', '[]', '[]', 'claude-code')",
    ).run(node.id);
    const session = setup.sessionRegistry.registerSession(node.id, "dev-worker@auto-rehydrate");
    setup.sessionRegistry.updateStatus(session.id, "detached");
    setup.sessionRegistry.updateStartupStatus(session.id, "ready");
    setup.sessionRegistry.updateResumeToken(session.id, "claude_id", "00000000-0000-4000-8000-000000000123", "hook");
    setup.tmuxAdapter.probeSession = vi.fn(async () => ({ state: "absent" as const })) as never;
    return { rig, node, session };
  }

  function post(rigId: string, revision: string) {
    return setup.app.request(`/api/startup/${rigId}/dev.worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume", revision }),
    });
  }

  it("runs preflight before capture and only then launches from the persisted snapshot", async () => {
    const { rig, node } = pendingSeat();
    const order: string[] = [];
    const preflight = vi.spyOn(setup.restoreOrchestrator, "preflightSnapshotData")
      .mockImplementation(async () => {
        order.push("preflight");
        return { ok: true } as never;
      });
    const captured = {
      id: "snap-auto-rehydrate",
      rigId: rig.id,
      kind: "auto-rehydrate",
      status: "complete",
      data: {},
      createdAt: new Date().toISOString(),
    };
    const capture = vi.spyOn(setup.snapshotCapture, "captureSnapshot").mockImplementation(() => {
      order.push("capture");
      return captured as never;
    });
    const launch = vi.spyOn(setup.restoreOrchestrator, "launchSingleNode").mockImplementation(async () => {
      order.push("launch");
      return {
        ok: true,
        launched: [{ nodeId: node.id, logicalId: node.logicalId, status: "resumed" }],
      } as never;
    });

    const response = await post(rig.id, startupRevision(db, node));
    expect(response.status).toBe(200);
    expect(order).toEqual(["preflight", "capture", "launch"]);
    expect(preflight).toHaveBeenCalledWith(
      expect.objectContaining({ rig: expect.objectContaining({ id: rig.id }) }),
      { fsOps: { exists: expect.any(Function) } },
    );
    expect(capture).toHaveBeenCalledWith(rig.id, "auto-rehydrate", { preparedData: expect.any(Object) });
    expect(launch).toHaveBeenCalledWith(rig.id, node.logicalId, expect.objectContaining({ snapshotId: captured.id }));
  });

  it("does not persist an auto-rehydrate snapshot when preflight blocks it", async () => {
    const { rig, node } = pendingSeat();
    const preflight = vi.spyOn(setup.restoreOrchestrator, "preflightSnapshotData").mockResolvedValue({
      ok: false,
      code: "pre_restore_validation_failed",
      message: "Restore pre-validation failed; no restore mutation was attempted.",
      validation: {
        blockers: [{
          code: "missing_startup_file",
          message: "Required startup file is missing: /tmp/AGENTS.md",
          remediation: "Restore the file, then retry.",
        }],
        warnings: ["fixture warning"],
      },
      topology: { intendedRoster: [node.id], excludedNodes: [] },
    } as never);
    const capture = vi.spyOn(setup.snapshotCapture, "captureSnapshot");
    const launch = vi.spyOn(setup.restoreOrchestrator, "launchSingleNode");

    const response = await post(rig.id, startupRevision(db, node));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      status: "not_attempted",
      code: "pre_restore_validation_failed",
      snapshotKind: "auto-rehydrate",
      blockers: [{ code: "missing_startup_file" }],
    });
    expect(preflight).toHaveBeenCalledOnce();
    expect(capture).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
    expect(setup.snapshotRepo.listSnapshots(rig.id)).toEqual([]);
  });
});
