#!/usr/bin/env bash
# Install dependencies and build OpenRig Personal Local.
#
# Idempotent: safe to re-run. Does not modify anything outside this repository.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

say() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

say "Checking toolchain"
command -v node >/dev/null 2>&1 || die "node is required (^22 || ^24)"
command -v npm  >/dev/null 2>&1 || die "npm is required (ships with node)"

node_major=$(node -p 'process.versions.node.split(".")[0]')
case "$node_major" in
  22|24) ;;
  *) die "unsupported Node major version $node_major (need 22 or 24)" ;;
esac

printf '    node %s / npm %s\n' "$(node -v)" "$(npm -v)"

say "Installing dependencies (npm ci)"
npm ci

say "Building workspaces (npm run build)"
npm run build

say "Checking output"
[ -f "$ROOT/packages/cli/dist/bin-wrapper.js" ] \
  || die "build finished but packages/cli/dist/bin-wrapper.js is missing"

cat <<'EOF'

Build complete.

Next steps:
  1. Add the shim to PATH:
       export PATH="$PWD/runtime:$PATH"
  2. Verify:
       rig --version
  3. Start the daemon:
       rig status && rig daemon start

Optional companions for full agent teams (install with your own package manager):
  - Python 3            (auxiliary tooling)
  - opencode            (agent runtime adapter)
  - dsh                 (agent runtime adapter)
  - tmux >= 3.4         (multi-seat terminal control)
  - your vendor CLIs    (Claude Code, Codex, ...) plus their own credentials

See RUNTIME.md for versions, environment variables and troubleshooting.
EOF
