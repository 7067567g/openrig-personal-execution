# Roadmap

These are things we'd welcome help with. Most came from the community, and most are small enough for one pull request.
This isn't a schedule or a promise: we release often, and an item ships when a good change for it lands.

To see what's being worked on, by release and theme, open the [OpenRig roadmap board](https://github.com/users/mvschwarz/projects/1).
Issues labelled `good first issue` are also listed on the [contribute page](https://github.com/mvschwarz/openrig/contribute).

## How to help

1. Pick an item and comment on its issue to say you're working on it and coordinate with others. A maintainer can assign
   you to make that work visible. If it has no issue yet, open one first.
2. Read `CONTRIBUTING.md`, and ask your agent to use the `developing-openrig` skill. It's a map of how OpenRig is
   built, tested and changed.
3. Open a pull request that says what a user gets and how you verified it.

If more than one pull request arrives for the same item, we take the best one, and the first equivalent one breaks a
tie. Feel free to coordinate on the issue first.

## Testing

- **Behavioural scenarios for more command families.** `docs/as-built/test-layers.md` has a "Help wanted" list of
  `rig` command families that have no scenario yet, each with a suggested first check. One family per pull request is
  ideal.

## Agents and runtimes

- **Codex seats that can reach the local daemon by default** (#275), with an easy opt-out.
- **Custom Codex providers such as Bedrock** (#194): accept providers that authenticate with an environment key, and
  forward their token.
- **Operator recovery for Pi and Oh My Pi seats** (#41).
- **More agent apps:** we're working out one way for any coding-agent CLI to plug into OpenRig. More on this soon
  (design discussion: #43).

## Next version planning

- **Seat load isolation and resource budgets** — P0/P1 (DSH shim, admission, budgets,
  toolchain/provider limits, `rig ps --resources`) shipped in the 0.7.0 pre-line and
  are carried into the local 0.1.0 line. Remaining work:
  split interactive DSH Web seats from isolated background workers (P2), then add
  per-seat Linux cgroup v2 budgets (P3). This extends
  the host-aware resource budget item (#80). Detailed proposal:
  [seat-load-isolation-and-resource-budgets-plan.md](docs/reference/seat-load-isolation-and-resource-budgets-plan.md).

## Slack

- **A DM or private channel for single-user setups** (#313).
- **A channel map** (#192): one channel per seat, keyed by channel ID.

## Reliability and everyday use

- **A configurable readiness window for fresh launches** (#182), so seats under load don't time out at a fixed 30
  seconds.
- **Draft-aware delivery** (#48): automated sends wait while someone is typing in a seat, or a seat can be set to
  inbox-only.
- **A host-aware resource budget for seats** (#80).
- **Predictable `rig up` over a stopped rig with the same name.**
- **Codex seats that leave a repository's tracked `AGENTS.md` alone** (related: #64).
- **Install and run on Node 26.**

Bugs aren't listed here. Please file them as issues; anything labelled `good first issue` is a good place to start.
