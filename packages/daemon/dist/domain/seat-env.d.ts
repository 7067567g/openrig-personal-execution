/**
 * Launch environment a rig declares for its seats: `env:` at rig level and at member level in
 * rig.yaml, plus one-off `rig up --env KEY=VALUE` overrides.
 *
 * These values are written into the seat's tmux launch command line and the process environment.
 * Local processes can read them (#306), so they are for non-secret settings only.
 */
export type SeatEnv = Record<string, string>;
/** Tmux session variable listing the declared keys, so the managed Claude `env -i` launch can
 *  forward exactly those variables from the pane shell. Reserved by the OPENRIG_ prefix. */
export declare const SEAT_ENV_KEYS_VAR = "OPENRIG_SEAT_ENV_KEYS";
export declare function validateSeatEnvName(name: string): string | null;
/** Validate a raw `env:` block. `path` prefixes each message, e.g. `env` or `pods[0].members[1].env`. */
export declare function validateSeatEnv(raw: unknown, path: string): string[];
/** Normalize an already-validated `env:` block; an absent or empty block stays undefined. */
export declare function normalizeSeatEnv(raw: unknown): SeatEnv | undefined;
/** The one-off env a request body carries, or undefined when it carries none this launch can
 *  use. `/api/up` and `/api/bundles/install` answered requests with an `envOverride` field as if
 *  the field weren't there before it meant something; a malformed one keeps getting that answer
 *  rather than a new refusal. The CLI checks `--env` itself before sending. */
export declare function readSeatEnvOverride(raw: unknown): SeatEnv | undefined;
/** Parse the `KEY=VALUE` form `rig up --env` takes. The value may contain `=`. */
export declare function parseSeatEnvAssignment(text: string): {
    ok: true;
    name: string;
    value: string;
} | {
    ok: false;
    error: string;
};
/** Effective env for one seat: rig, then member, then a one-off override. Later wins. */
export declare function mergeSeatEnv(...layers: Array<SeatEnv | null | undefined>): SeatEnv;
export declare function parseStoredSeatEnv(json: string | null | undefined): SeatEnv | null;
/** The variables a launch hands the seat: the env itself plus the key list the managed Claude
 *  launch reads back. Empty when the seat declares nothing, so existing seats are unchanged. */
export declare function seatEnvLaunchVars(env: SeatEnv): SeatEnv;
//# sourceMappingURL=seat-env.d.ts.map