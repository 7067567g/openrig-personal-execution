import { describe, expect, it } from "vitest";
import { deriveResumeToken } from "../src/domain/resume-token-capture.js";
import { resumeTypeForRuntime, validateResumeToken } from "../src/domain/resume-token-validation.js";

describe("OpenCode/DSH resume metadata", () => {
  it.each([
    ["opencode", "opencode_session", "ses_eb01f5ff2ffeAekzkhBH8mEJLd"],
    ["dsh", "dsh_session", "session-9b90e2bc-d6c2-4649-842f-b9f9c479489c"],
  ] as const)("maps %s to a validated id-shaped resume token", (runtime, resumeType, token) => {
    expect(resumeTypeForRuntime(runtime)).toBe(resumeType);
    expect(validateResumeToken(runtime, token)).toEqual({ ok: true, resumeType, token });
    expect(validateResumeToken(runtime, `../${token}`)).toMatchObject({ ok: false });
  });

  it("derives the runner sidecar token for OpenCode and DSH without pane scraping", async () => {
    await expect(deriveResumeToken(
      { runtime: "opencode", sessionName: "exec-tdo-oc@opencode-dsh" },
      { opencodeRunnerStateStore: { readSessionFile: () => ({ ok: true, sessionFile: "ses_abc" }) } },
    )).resolves.toEqual({ outcome: "captured", resumeType: "opencode_session", token: "ses_abc" });

    await expect(deriveResumeToken(
      { runtime: "dsh", sessionName: "exec-tdo-dsh@opencode-dsh" },
      { dshRunnerStateStore: { readSessionFile: () => ({ ok: true, sessionFile: "session-abc" }) } },
    )).resolves.toEqual({ outcome: "captured", resumeType: "dsh_session", token: "session-abc" });
  });

  it("reports a missing sidecar as an honest skip, not a fabricated token", async () => {
    await expect(deriveResumeToken(
      { runtime: "opencode", sessionName: "seat" },
      { opencodeRunnerStateStore: { readSessionFile: () => ({ ok: false, reason: "missing_sidecar" }) } },
    )).resolves.toEqual({ outcome: "skipped", reason: "missing_sidecar" });
  });
});
