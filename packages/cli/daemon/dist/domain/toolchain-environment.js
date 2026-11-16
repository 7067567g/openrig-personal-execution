// Toolchain concurrency projection — one per-seat budget expressed through the
// environment variables build/test tools already understand.
//
// Scope: ONLY the seat process. The daemon never applies these to its own
// process environment, and they are not written to the rig spec. NodeLauncher
// merges the result into the launch env of the tmux session it creates for one
// seat, so a build a seat runs inherits the cap while every other seat and the
// daemon are unaffected.
//
// Default posture: DISABLED (or jobs = 0) returns an empty map. Existing
// behaviour — whatever the daemon/shell/seat spec already provides — is
// untouched, and on merge the pre-existing value wins.
//
// `MAKEFLAGS` is special-cased: GNU make reads its job server from `-jN`, not
// from a numeric value. `UV_THREADPOOL_SIZE` is not a build-job flag, but it is
// the libuv worker budget the plan groups with the toolchain set; it accepts the
// same N.
/** The exact set of variables this projection owns, in a stable order. */
export const TOOLCHAIN_ENV_VARS = [
    "CARGO_BUILD_JOBS",
    "RUST_TEST_THREADS",
    "MAKEFLAGS",
    "CMAKE_BUILD_PARALLEL_LEVEL",
    "UV_CONCURRENT_BUILDS",
    "NPM_CONFIG_JOBS",
    "UV_THREADPOOL_SIZE",
];
export const DEFAULT_TOOLCHAIN_CONCURRENCY_CONFIG = {
    enabled: false,
    jobs: 0,
};
/**
 * Build the environment additions for a seat. Returns `{}` unless the feature is
 * enabled AND `jobs` is a positive integer: an enabled-but-zero config is the
 * explicit "no projection" state, not an implicit unlimited build.
 */
export function projectToolchainEnvironment(config) {
    if (!config.enabled)
        return {};
    if (!Number.isInteger(config.jobs) || config.jobs <= 0)
        return {};
    const jobs = String(config.jobs);
    return {
        CARGO_BUILD_JOBS: jobs,
        RUST_TEST_THREADS: jobs,
        MAKEFLAGS: `-j${jobs}`,
        CMAKE_BUILD_PARALLEL_LEVEL: jobs,
        UV_CONCURRENT_BUILDS: jobs,
        NPM_CONFIG_JOBS: jobs,
        UV_THREADPOOL_SIZE: jobs,
    };
}
//# sourceMappingURL=toolchain-environment.js.map