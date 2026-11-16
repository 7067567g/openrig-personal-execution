#!/bin/sh
# rig shim for OpenRig Personal Local.
#
# Resolves the repository root from this script's location so the tree can be
# cloned anywhere. Override with OPENRIG_ROOT when the shim is copied elsewhere.
set -eu

script_path=$0
# Resolve symlinks so a symlinked shim still finds the repository.
while [ -L "$script_path" ]; do
  link_target=$(readlink "$script_path")
  case $link_target in
    /*) script_path=$link_target ;;
    *) script_path=$(dirname "$script_path")/$link_target ;;
  esac
done

ROOT=${OPENRIG_ROOT:-$(cd "$(dirname "$script_path")/.." && pwd)}
ENTRY=$ROOT/packages/cli/dist/bin-wrapper.js

if [ ! -f "$ENTRY" ]; then
  echo "rig-shim: CLI bundle not found at $ENTRY" >&2
  echo "rig-shim: run 'bash $ROOT/runtime/install.sh' (or 'npm ci && npm run build') first" >&2
  exit 127
fi

exec node "$ENTRY" "$@"
