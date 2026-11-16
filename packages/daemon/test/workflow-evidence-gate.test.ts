// OpenRig r7 — closure evidence file gate.
//
// The two failures the round pins:
//   1. evidence_ref is DECLARED but the artifact was never produced;
//   2. the artifact EXISTS but changed after its digest was taken.
//
// Both must refuse the advance/closure with ZERO writes, because a gate that
// mutates state before refusing is not a gate.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createDb } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { ALL_MIGRATIONS } from "../src/db/all-migrations.js";
import { EventBus } from "../src/domain/event-bus.js";
import { QueueRepository } from "../src/domain/queue-repository.js";
import { OutboxHandler } from "../src/domain/outbox-handler.js";
import { WorkflowRuntime } from "../src/domain/workflow-runtime.js";

const SPEC = `workflow:
  id: evidence-gate
  version: 1
  objective: exercise the closure evidence file gate
  entry:
    role: producer
  roles:
    producer:
      preferred_targets:
        - producer@rig
    reviewer:
      preferred_targets:
        - reviewer@rig
  exception_routing:
    orchestrator_role: producer
  steps:
    - id: produce
      actor_role: producer
      allowed_exits:
        - handoff
        - waiting
        - failed
    - id: review
      actor_role: reviewer
      allowed_exits:
        - done
        - waiting
        - failed
  invariants:
    allowed_exits:
      - handoff
      - waiting
      - done
      - failed
`;

const GRAPH_SPEC = `workflow:
  id: evidence-gate-graph
  version: 1
  objective: exercise the gate on the dependency-graph executor
  entry:
    role: producer
  roles:
    producer:
      preferred_targets:
        - producer@rig
    reviewer:
      preferred_targets:
        - reviewer@rig
  steps:
    - id: produce
      actor_role: producer
      depends_on: []
      allowed_exits:
        - done
        - failed
    - id: review
      actor_role: reviewer
      depends_on:
        - produce
      allowed_exits:
        - done
  invariants:
    allowed_exits:
      - handoff
      - waiting
      - done
      - failed
`;

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

describe("workflow closure evidence file gate", () => {
  let db: ReturnType<typeof createDb>;
  let bus: EventBus;
  let queue: QueueRepository;
  let runtime: WorkflowRuntime;
  let root: string;
  let specPath: string;
  let graphSpecPath: string;

  const mutationCount = () => (db.prepare("SELECT total_changes() AS n").get() as { n: number }).n;

  beforeEach(() => {
    db = createDb();
    migrate(db, ALL_MIGRATIONS);
    db.prepare("INSERT INTO rigs (id, name) VALUES ('r-1', 'rig')").run();
    bus = new EventBus(db);
    queue = new QueueRepository(db, bus, { validateRig: () => true });
    queue.attachOutbox(new OutboxHandler(db));
    root = realpathSync(mkdtempSync(join(tmpdir(), "wf-evidence-")));
    specPath = join(root, "spec.yaml");
    writeFileSync(specPath, SPEC);
    graphSpecPath = join(root, "graph-spec.yaml");
    writeFileSync(graphSpecPath, GRAPH_SPEC);
    runtime = new WorkflowRuntime({ db, eventBus: bus, queueRepo: queue });
  });

  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  const instantiate = (path = specPath) =>
    runtime.instantiate({ specPath: path, rootObjective: "evidence gate", createdBySession: "ops@rig" });

  const artifact = (relative: string, content: string): string => {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return path;
  };

  it("refuses a DECLARED-BUT-NOT-PRODUCED evidence_ref with zero writes", async () => {
    const run = await instantiate();
    const before = mutationCount();
    expect(existsSync(join(root, "proof", "never-written.md"))).toBe(false);

    await expect(runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/never-written.md" },
    })).rejects.toMatchObject({ code: "evidence_ref_missing" });

    // Zero-write refusal: no queue close, no trail, no frontier move, no event.
    expect(mutationCount()).toEqual(before);
    expect(queue.getById(run.entryQitemId)?.state).toBe("pending");
    expect(runtime.inspect(run.instance.instanceId).instance.status).toBe("active");
    expect(runtime.inspect(run.instance.instanceId).frontier.map((packet) => packet.packetId)).toEqual([run.entryQitemId]);
    expect(db.prepare("SELECT count(*) AS n FROM workflow_step_trails").get()).toEqual({ n: 0 });
  });

  it("refuses an ARTIFACT-CHANGED digest with zero writes", async () => {
    artifact("proof/release.md", "the reviewed artifact\n");
    const declaredDigest = sha256("the reviewed artifact\n");
    const run = await instantiate();
    const before = mutationCount();

    // The artifact is edited after the digest was taken.
    writeFileSync(join(root, "proof", "release.md"), "the reviewed artifact\ntampered after review\n");

    await expect(runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/release.md", evidence_digest: declaredDigest },
    })).rejects.toMatchObject({ code: "evidence_digest_mismatch" });

    expect(mutationCount()).toEqual(before);
    expect(queue.getById(run.entryQitemId)?.state).toBe("pending");
    expect(runtime.inspect(run.instance.instanceId).instance.status).toBe("active");
  });

  it("accepts an existing file and records the verified sha256 on the trail", async () => {
    artifact("proof/release.md", "final bytes\n");
    const run = await instantiate();

    const projected = await runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/release.md" },
    });

    expect(projected.nextStepId).toBe("review");
    expect(queue.getById(run.entryQitemId)?.state).toBe("handed-off");
    const trail = runtime.trailLog.listForInstance(run.instance.instanceId)
      .find((row) => row.priorQitemId === run.entryQitemId);
    expect(trail?.closureEvidence).toMatchObject({
      evidence_ref: "proof/release.md",
      evidence_digest: sha256("final bytes\n"),
    });
  });

  it("accepts a matching digest declared with a sha256: prefix and upper-case hex", async () => {
    artifact("proof/release.md", "final bytes\n");
    const run = await instantiate();

    await runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: {
        evidence_ref: "proof/release.md",
        evidence_digest: `sha256:${sha256("final bytes\n").toUpperCase()}`,
      },
    });

    const trail = runtime.trailLog.listForInstance(run.instance.instanceId)
      .find((row) => row.priorQitemId === run.entryQitemId);
    expect(trail?.closureEvidence).toMatchObject({ evidence_digest: sha256("final bytes\n") });
  });

  it("resolves a relative ref against the spec directory, not the daemon cwd", async () => {
    artifact("proof/relative.md", "relative artifact\n");
    const run = await instantiate();

    await expect(runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/relative.md" },
    })).resolves.toMatchObject({ nextStepId: "review" });
  });

  it("accepts an absolute evidence_ref and refuses a directory", async () => {
    const absolute = artifact("proof/absolute.md", "absolute artifact\n");
    mkdirSync(join(root, "proof", "a-directory"), { recursive: true });

    const first = await instantiate();
    await expect(runtime.project({
      instanceId: first.instance.instanceId,
      currentPacketId: first.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: absolute },
    })).resolves.toMatchObject({ nextStepId: "review" });

    const second = await instantiate();
    const before = mutationCount();
    await expect(runtime.project({
      instanceId: second.instance.instanceId,
      currentPacketId: second.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/a-directory" },
    })).rejects.toMatchObject({ code: "evidence_ref_not_file" });
    expect(mutationCount()).toEqual(before);
  });

  it("refuses a malformed digest, and a digest with no ref, before any write", async () => {
    artifact("proof/release.md", "final bytes\n");
    const first = await instantiate();
    const beforeFirst = mutationCount();
    await expect(runtime.project({
      instanceId: first.instance.instanceId,
      currentPacketId: first.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/release.md", evidence_digest: "not-a-sha256" },
    })).rejects.toMatchObject({ code: "evidence_digest_invalid" });
    expect(mutationCount()).toEqual(beforeFirst);

    const second = await instantiate();
    const beforeSecond = mutationCount();
    await expect(runtime.project({
      instanceId: second.instance.instanceId,
      currentPacketId: second.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      closureEvidence: { evidence_digest: sha256("final bytes\n") },
    })).rejects.toMatchObject({ code: "evidence_digest_without_ref" });
    expect(mutationCount()).toEqual(beforeSecond);
  });

  it("does not gate waiting or failed exits (honest failure stays possible)", async () => {
    const waiting = await instantiate();
    await expect(runtime.project({
      instanceId: waiting.instance.instanceId,
      currentPacketId: waiting.entryQitemId,
      exit: "waiting",
      actorSession: "producer@rig",
      blockedOn: "external:proof",
      closureEvidence: { evidence_ref: "proof/not-there-yet.md" },
    })).resolves.toMatchObject({ closureReason: "waiting" });

    const failed = await instantiate();
    await expect(runtime.project({
      instanceId: failed.instance.instanceId,
      currentPacketId: failed.entryQitemId,
      exit: "failed",
      actorSession: "producer@rig",
      resultNote: "the artifact could not be produced",
      closureEvidence: { evidence_ref: "proof/not-there-yet.md" },
    })).resolves.toMatchObject({ closureReason: "failed" });
  });

  it("leaves a closure with no evidence_ref on the pre-existing path", async () => {
    const run = await instantiate();
    await expect(runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "handoff",
      actorSession: "producer@rig",
      resultNote: "no artifact declared",
    })).resolves.toMatchObject({ nextStepId: "review" });
    // The pre-gate trail shape is unchanged: no digest key is invented when
    // no file was declared.
    const trail = runtime.trailLog.listForInstance(run.instance.instanceId)
      .find((row) => row.priorQitemId === run.entryQitemId);
    expect((trail?.closureEvidence as Record<string, unknown> | null | undefined)?.evidence_digest).toBeUndefined();
  });

  it("gates the dependency-graph executor through the same pre-write check", async () => {
    const run = await instantiate(graphSpecPath);
    const before = mutationCount();

    await expect(runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "done",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/graph-artifact.md" },
    })).rejects.toMatchObject({ code: "evidence_ref_missing" });
    expect(mutationCount()).toEqual(before);
    expect(runtime.inspect(run.instance.instanceId).instance.status).toBe("active");

    artifact("proof/graph-artifact.md", "graph artifact\n");
    await expect(runtime.project({
      instanceId: run.instance.instanceId,
      currentPacketId: run.entryQitemId,
      exit: "done",
      actorSession: "producer@rig",
      closureEvidence: { evidence_ref: "proof/graph-artifact.md" },
    })).resolves.toMatchObject({ nextStepId: "review" });
  });
});
