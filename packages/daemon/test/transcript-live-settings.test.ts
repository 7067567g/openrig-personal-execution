import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsStore } from "../src/domain/user-settings/settings-store.js";
import { createTranscriptRotationOptionsResolver } from "../src/domain/transcript-rotation.js";
import { ConfigStore } from "../../cli/src/config-store.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "live-transcripts-")); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); rmSync(dir, { recursive: true, force: true }); });

it("observes actual CLI config writes/reset and retains settings through malformed intermediate JSON", async () => {
  const file = join(dir, "config.json");
  const cli = new ConfigStore(file);
  const resolve = createTranscriptRotationOptionsResolver(new SettingsStore(file));
  expect(resolve()).toEqual({ lines: 1000, pollIntervalMs: 2000 });
  cli.set("transcripts.poll_interval_seconds", "3"); cli.set("transcripts.lines", "40");
  await vi.advanceTimersByTimeAsync(1000);
  expect(resolve()).toEqual({ lines: 40, pollIntervalMs: 3000 });
  writeFileSync(file, "{"); await vi.advanceTimersByTimeAsync(1000);
  expect(resolve()).toEqual({ lines: 40, pollIntervalMs: 3000 });
  cli.reset(); await vi.advanceTimersByTimeAsync(1000);
  expect(resolve()).toEqual({ lines: 1000, pollIntervalMs: 2000 });
});

it.each(["0", "-1", "2junk", "1.5", "3601", "2147483648"])("rejects unsafe live intervals %s at both write surfaces", (value) => {
  const file = join(dir, "config.json");
  expect(() => new ConfigStore(file).set("transcripts.poll_interval_seconds", value)).toThrow();
  expect(() => new SettingsStore(file).set("transcripts.poll_interval_seconds", value)).toThrow();
});

it("pins the 2s/1000-line default and accepts an explicit lower-cost capture policy", async () => {
  const file = join(dir, "config.json");
  const cli = new ConfigStore(file);
  const resolve = createTranscriptRotationOptionsResolver(new SettingsStore(file));

  // Defaults are the status quo: no new production behaviour is introduced.
  expect(resolve()).toEqual({ lines: 1000, pollIntervalMs: 2000 });
  expect(cli.resolve().transcripts.pollIntervalSeconds).toBe(2);
  expect(cli.resolve().transcripts.lines).toBe(1000);

  // The opt-in lowering path (nobody watching the UI): fewer lines, rarer polls.
  cli.set("transcripts.poll_interval_seconds", "10");
  cli.set("transcripts.lines", "200");
  await vi.advanceTimersByTimeAsync(1000);
  expect(resolve()).toEqual({ lines: 200, pollIntervalMs: 10000 });
  expect(cli.resolve().transcripts.pollIntervalSeconds).toBe(10);
  expect(cli.resolve().transcripts.lines).toBe(200);

  // Out-of-range values are still refused after the policy is lowered.
  expect(() => cli.set("transcripts.poll_interval_seconds", "0")).toThrow();
  expect(() => cli.set("transcripts.lines", "0")).toThrow();
});
