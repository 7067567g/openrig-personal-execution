import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOOLCHAIN_CONCURRENCY_CONFIG,
  TOOLCHAIN_ENV_VARS,
  projectToolchainEnvironment,
} from "../src/domain/toolchain-environment.js";

describe("projectToolchainEnvironment", () => {
  it("projects nothing by default (status quo)", () => {
    expect(DEFAULT_TOOLCHAIN_CONCURRENCY_CONFIG).toEqual({ enabled: false, jobs: 0 });
    expect(projectToolchainEnvironment(DEFAULT_TOOLCHAIN_CONCURRENCY_CONFIG)).toEqual({});
  });

  it("projects the same N into every owned variable when enabled", () => {
    const env = projectToolchainEnvironment({ enabled: true, jobs: 4 });
    expect(Object.keys(env).sort()).toEqual([...TOOLCHAIN_ENV_VARS].sort());
    expect(env).toEqual({
      CARGO_BUILD_JOBS: "4",
      RUST_TEST_THREADS: "4",
      MAKEFLAGS: "-j4",
      CMAKE_BUILD_PARALLEL_LEVEL: "4",
      UV_CONCURRENT_BUILDS: "4",
      NPM_CONFIG_JOBS: "4",
      UV_THREADPOOL_SIZE: "4",
    });
  });

  it("treats jobs <= 0 or non-integers as explicit no-projection, even when enabled", () => {
    for (const jobs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(projectToolchainEnvironment({ enabled: true, jobs })).toEqual({});
    }
  });

  it("does not invent any variable outside the documented set", () => {
    const env = projectToolchainEnvironment({ enabled: true, jobs: 2 });
    for (const key of Object.keys(env)) {
      expect(TOOLCHAIN_ENV_VARS).toContain(key);
    }
    expect(env).not.toHaveProperty("RUSTFLAGS");
    expect(env).not.toHaveProperty("OPENRIG_RESOURCES_TOOLCHAIN_JOBS");
  });
});
