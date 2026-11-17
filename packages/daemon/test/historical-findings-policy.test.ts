import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// D24 closure contract: every historical finding is explicitly mounted to an
// OpenRig defense object or explicitly deferred with a decision id. The policy
// must also be semantically closed: disposition and mapping agree, declared
// counts are exact, and every acceptanceTestId resolves to the embedded,
// source-bound 57-id acceptance inventory. Adopted rows need a known test or an
// explicit accepted-risk disposition.
const root = resolve(__dirname, "../../..");
const policyPath = resolve(root, "docs/as-built/historical-findings-policy.json");
const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const defenseIds = new Set(Array.from({ length: 25 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`));
const dispositions = new Set(["adopt", "defer", "already-covered"]);
const findingClasses = new Set([
  "accepted_risk",
  "already_covered",
  "design_gap",
  "meta_requirement",
  "observed_defect",
  "unimplemented",
]);
const severities = new Set(["S1", "S2", "S3"]);
const atId = /^AT-[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
const expectedAcceptanceTests = 57;

function computedCounts(findings: any[]) {
  const out: Record<string, number> = { DEFERRED: 0 };
  for (const finding of findings) {
    const mapping = finding.mapping ?? {};
    if (mapping.kind === "defense" && defenseIds.has(mapping.defenseId)) {
      out[mapping.defenseId] = (out[mapping.defenseId] ?? 0) + 1;
    } else if (mapping.kind === "deferred") {
      out.DEFERRED += 1;
    }
  }
  return out;
}

function validatePolicy(document: any): string[] {
  const errors: string[] = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return ["policy root must be an object"];
  }
  if (document.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!Array.isArray(document.findings)) return [...errors, "findings must be an array"];
  if (document.findings.length !== 106) {
    errors.push(`findings must contain exactly 106 entries; got ${document.findings.length}`);
  }

  const inventory = document.acceptanceTestInventory;
  const knownTests = new Set<string>();
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    errors.push("acceptanceTestInventory must be an object");
  } else {
    if (typeof inventory.source !== "string" || !inventory.source.trim()) {
      errors.push("acceptanceTestInventory.source must be a non-empty string");
    }
    if (typeof inventory.sourceSchema !== "string" || !inventory.sourceSchema.trim()) {
      errors.push("acceptanceTestInventory.sourceSchema must be a non-empty string");
    }
    if (typeof inventory.sourceSha256 !== "string" || !/^[0-9a-f]{64}$/i.test(inventory.sourceSha256)) {
      errors.push("acceptanceTestInventory.sourceSha256 must be 64-hex");
    }
    if (!Array.isArray(inventory.testIds)) {
      errors.push("acceptanceTestInventory.testIds must be an array");
    } else {
      if (inventory.testIds.length !== expectedAcceptanceTests) {
        errors.push(
          `acceptanceTestInventory.testIds must contain exactly ${expectedAcceptanceTests} ids; got ${inventory.testIds.length}`,
        );
      }
      inventory.testIds.forEach((id: any, index: number) => {
        if (typeof id !== "string" || !atId.test(id)) {
          errors.push(`acceptanceTestInventory.testIds[${index}] must match ${atId}; got ${JSON.stringify(id)}`);
          return;
        }
        if (knownTests.has(id)) errors.push(`acceptanceTestInventory.testIds contains duplicate id '${id}'`);
        knownTests.add(id);
      });
    }
  }

  const seen = new Set<string>();
  let mapped = 0;
  let deferred = 0;
  document.findings.forEach((finding: any, index: number) => {
    let label = `findings[${index}]`;
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
      errors.push(`${label} must be an object`);
      return;
    }
    if (typeof finding.findingId !== "string" || !finding.findingId.trim()) {
      errors.push(`${label}.findingId must be a non-empty string`);
    } else {
      label = finding.findingId;
      if (seen.has(finding.findingId)) errors.push(`duplicate findingId: ${finding.findingId}`);
      seen.add(finding.findingId);
    }
    if (!severities.has(finding.severity)) {
      errors.push(`${label}.severity must be one of S1, S2, S3; got ${JSON.stringify(finding.severity)}`);
    }
    if (!dispositions.has(finding.disposition)) {
      errors.push(
        `${label}.disposition must be one of adopt, already-covered, defer; got ${JSON.stringify(finding.disposition)}`,
      );
    }
    if (!findingClasses.has(finding.findingClass)) {
      errors.push(`${label}.findingClass is not a known class; got ${JSON.stringify(finding.findingClass)}`);
    }
    const testId = finding.acceptanceTestId;
    let resolvedTest = false;
    if (typeof testId !== "string" || !atId.test(testId)) {
      errors.push(`${label}.acceptanceTestId must match ${atId}; got ${JSON.stringify(testId)}`);
    } else if (knownTests.size > 0) {
      if (knownTests.has(testId)) {
        resolvedTest = true;
      } else if (!(finding.disposition === "adopt" && finding.findingClass === "accepted_risk")) {
        errors.push(`${label}.acceptanceTestId '${testId}' is unknown to acceptanceTestInventory`);
      }
    }
    const anchor = finding.implementationAnchor;
    if (typeof anchor !== "string") {
      errors.push(`${label}.implementationAnchor must be a non-empty string`);
    } else {
      const stripped = anchor.trim();
      if (stripped.length < 3 || stripped.length > 240) {
        errors.push(`${label}.implementationAnchor must be 3..240 characters after stripping`);
      }
      if (/[\u0000-\u001f]/.test(anchor)) {
        errors.push(`${label}.implementationAnchor must not contain control characters or newlines`);
      }
    }
    if (finding.disposition === "adopt" && finding.findingClass !== "accepted_risk" && !resolvedTest) {
      errors.push(`${label} is adopted but has no known acceptance test and is not an explicit accepted_risk`);
    }

    const mapping = finding.mapping;
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      errors.push(`${label}.mapping must be an object`);
      return;
    }
    if (mapping.kind === "defense") {
      mapped += 1;
      if (!defenseIds.has(mapping.defenseId)) {
        errors.push(`${label}.mapping.defenseId must be one of D01..D25; got ${JSON.stringify(mapping.defenseId)}`);
      }
      if (finding.disposition === "defer") {
        errors.push(`${label} has disposition 'defer' but mapping.kind is 'defense'; an explicit deferral must not claim a runtime defense`);
      }
    } else if (mapping.kind === "deferred") {
      deferred += 1;
      if (!/^[A-Z]-/.test(String(mapping.decisionId ?? ""))) {
        errors.push(`${label}.mapping.decisionId must match ^[A-Z]-; got ${JSON.stringify(mapping.decisionId)}`);
      }
      if (typeof mapping.reason !== "string" || mapping.reason.length <= 20) {
        errors.push(`${label}.mapping.reason must be longer than 20 characters`);
      }
      if (finding.disposition === "adopt") {
        errors.push(`${label} has disposition 'adopt' but mapping.kind is 'deferred'; an adopted row must be backed by a defense (or be explicitly deferred)`);
      }
    } else {
      errors.push(`${label}.mapping.kind must be 'defense' or 'deferred'; got ${JSON.stringify(mapping.kind)}`);
    }

    if (finding.findingClass === "already_covered" && finding.disposition !== "already-covered") {
      errors.push(`${label} has findingClass 'already_covered' but disposition is ${JSON.stringify(finding.disposition)}`);
    } else if (
      ["accepted_risk", "design_gap", "meta_requirement", "observed_defect", "unimplemented"].includes(
        finding.findingClass,
      ) &&
      finding.disposition === "already-covered"
    ) {
      errors.push(`${label} has findingClass ${JSON.stringify(finding.findingClass)} but disposition is 'already-covered'`);
    }
  });

  if (mapped + deferred !== 106) {
    errors.push(`mapped+deferred must equal 106; got ${mapped + deferred} (mapped=${mapped}, deferred=${deferred})`);
  }
  if (mapped < 90) errors.push(`mapped findings must be >= 90; got ${mapped}`);
  if (deferred < 1) errors.push(`deferred findings must be >= 1; got ${deferred}`);

  const computed = computedCounts(document.findings);
  const declared = document.counts;
  if (!declared || typeof declared !== "object" || Array.isArray(declared)) {
    errors.push("counts must be an object");
  } else {
    const declaredKeys = Object.keys(declared);
    const computedKeys = Object.keys(computed);
    for (const key of declaredKeys) {
      if (key !== "DEFERRED" && !defenseIds.has(key)) errors.push(`counts has unknown key '${key}'`);
      if (!Number.isInteger(declared[key]) || declared[key] < 0) {
        errors.push(`counts['${key}'] must be a non-negative integer`);
      }
    }
    for (const key of computedKeys) {
      if (!(key in declared)) errors.push(`counts is missing declared key '${key}'`);
      else if (declared[key] !== computed[key]) {
        errors.push(`counts['${key}'] must be ${computed[key]} from findings; got ${declared[key]}`);
      }
    }
    for (const key of declaredKeys) {
      if (!(key in computed)) errors.push(`counts has keys not present in findings: ${key}`);
    }
    const sum = Object.values(declared).reduce((total: number, value: any) => total + (Number(value) || 0), 0);
    if (sum !== 106) errors.push(`counts values must sum to 106; got ${sum}`);
  }
  return errors;
}

const clone = () => JSON.parse(JSON.stringify(policy));
const findingById = (document: any, id: string) => document.findings.find((f: any) => f.findingId === id);

describe("historical findings runtime-policy mount", () => {
  it("validates the mounted policy with no closure errors", () => {
    expect(validatePolicy(policy)).toEqual([]);
  });

  it("accounts for every historical finding exactly once", () => {
    const ids = policy.findings.map((f: any) => f.findingId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(106);
    const mapped = policy.findings.filter((f: any) => f.mapping.kind === "defense").length;
    const deferred = policy.findings.filter((f: any) => f.mapping.kind === "deferred").length;
    expect(mapped + deferred).toBe(ids.length);
    expect(mapped).toBeGreaterThanOrEqual(90);
    expect(deferred).toBeGreaterThanOrEqual(1);
  });

  it("declares exact counts that match the matrix", () => {
    expect(policy.counts).toEqual(computedCounts(policy.findings));
    expect(Object.values(policy.counts).reduce((a: any, b: any) => a + b, 0)).toBe(106);
  });

  it("maps every mounted finding to a known defense object or an explicit decision", () => {
    for (const f of policy.findings) {
      if (f.mapping.kind === "defense") expect(defenseIds.has(f.mapping.defenseId)).toBe(true);
      else if (f.mapping.kind === "deferred") {
        expect(f.mapping.reason.length).toBeGreaterThan(20);
        expect(f.mapping.decisionId).toMatch(/^[A-Z]-/);
      } else {
        throw new Error(`unknown mapping kind for ${f.findingId}`);
      }
    }
  });

  it("resolves every acceptanceTestId against the embedded 57-id inventory", () => {
    const inventory = policy.acceptanceTestInventory;
    expect(inventory.source).toContain("EXECUTION-TREE-v2.json");
    expect(inventory.sourceSchema).toBe("acceptanceMap");
    expect(inventory.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(inventory.testIds.length).toBe(57);
    expect(new Set(inventory.testIds).size).toBe(57);
    const known = new Set(inventory.testIds);
    for (const f of policy.findings) expect(known.has(f.acceptanceTestId)).toBe(true);
  });

  it("pins the acceptance inventory to EXECUTION-TREE-v2 source order", () => {
    const ids = policy.acceptanceTestInventory.testIds as string[];
    const digest = createHash("sha256").update(ids.join("\n")).digest("hex");
    expect(digest).toBe("edd72d1664deaad9302516ba81371e81fe10cc7050a48d71433813b72c8cee6d");
  });

  it("enforces disposition/mapping compatibility, including the accepted-risk exception", () => {
    const badAdoptDeferred = clone();
    const adopted = badAdoptDeferred.findings.find((f: any) => f.mapping.kind === "defense" && f.disposition === "adopt");
    adopted.mapping = { kind: "deferred", decisionId: "H-01", reason: "explicit deferred decision long enough to pass" };
    expect(validatePolicy(badAdoptDeferred).join("\n")).toContain("disposition 'adopt' but mapping.kind is 'deferred'");

    const badDeferDefense = clone();
    const deferredRow = badDeferDefense.findings.find((f: any) => f.mapping.kind === "deferred");
    deferredRow.mapping = { kind: "defense", defenseId: "D10" };
    expect(validatePolicy(badDeferDefense).join("\n")).toContain("disposition 'defer' but mapping.kind is 'defense'");

    const acceptedRisk = clone();
    const risk = acceptedRisk.findings.find((f: any) => f.mapping.kind === "deferred");
    risk.findingClass = "accepted_risk";
    expect(validatePolicy(acceptedRisk)).toEqual([]);
  });

  it("requires adopted rows to have a known test or an explicit accepted-risk disposition", () => {
    const bad = clone();
    const adopted = bad.findings.find((f: any) => f.disposition === "adopt" && f.findingClass !== "accepted_risk");
    adopted.acceptanceTestId = "AT-DOES-NOT-EXIST-01";
    expect(validatePolicy(bad).join("\n")).toContain("has no known acceptance test and is not an explicit accepted_risk");

    const accepted = clone();
    const acceptedRow = accepted.findings.find((f: any) => f.findingClass === "accepted_risk");
    acceptedRow.acceptanceTestId = "AT-DOES-NOT-EXIST-01";
    // An explicit accepted risk may use an unknown test id as the documented
    // accepted-risk alternative; all actual rows still resolve their ids.
    expect(validatePolicy(accepted)).toEqual([]);
  });

  it("records the HF-026 and HF-052 semantic fixes", () => {
    const hf026 = findingById(policy, "HF-026");
    expect(hf026.disposition).toBe("defer");
    expect(hf026.mapping).toMatchObject({ kind: "deferred", decisionId: "H-02" });

    const hf052 = findingById(policy, "HF-052");
    expect(hf052.findingClass).toBe("accepted_risk");
    expect(hf052.disposition).toBe("defer");
    expect(hf052.mapping).toMatchObject({ kind: "deferred", decisionId: "H-01" });
  });

  it("rejects the old HF-026/HF-052 contradictions if reintroduced", () => {
    const bad = clone();
    findingById(bad, "HF-026").mapping = { kind: "defense", defenseId: "D10" };
    findingById(bad, "HF-052").disposition = "adopt";
    const errors = validatePolicy(bad).join("\n");
    expect(errors).toContain("HF-026 has disposition 'defer' but mapping.kind is 'defense'");
    expect(errors).toContain("HF-052 has disposition 'adopt' but mapping.kind is 'deferred'");
  });
});
