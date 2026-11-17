#!/usr/bin/env bash
# Self-contained OpenRig test entry.
#
# Product lanes (`fast`, `security`, `full`) run entirely from this checkout.
# They never require a sibling workflow-group checkout, a foreign virtualenv,
# or machine-local files.
#
# Workflow-group tests are optional and opt-in through an explicit path:
#
#   OPENRIG_WORKFLOW_GROUP=/abs/path/to/workflow-group \
#     npm run test:openrig:workflow
#
# OPENRIG_WORKFLOW_GROUP has two states:
#   - UNSET: the external lane is skipped and the command exits 0.
#   - SET:   the external lane is STRICT. A missing/non-directory checkout, a
#            missing expected test file, or an interpreter without pytest exits 2.
# The strict rule applies to the fast, security and workflow lanes whenever the
# variable is present; it is not limited to the workflow lane. To skip the
# external lane while the variable is set in your shell:
#
#   env -u OPENRIG_WORKFLOW_GROUP npm run test:openrig:fast
#
# Set OPENRIG_WORKFLOW_GROUP_PYTHON to a Python interpreter with pytest
# installed; otherwise `python3` from PATH is used.
set -euo pipefail

MODE="${1:-fast}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_GROUP_EXPLICIT=0

PRODUCT_ENTRY_FILES=(
  packages/daemon/test/entry-guard-core.test.ts
  packages/daemon/test/entry-guard-atomic-token.test.ts
  packages/daemon/test/entry-guard-boot.test.ts
  packages/daemon/test/entry-guard-http-admission.test.ts
  packages/cli/test/entry-guard-error.test.ts
  packages/cli/test/entry-guard-json-denial.test.ts
  packages/cli/test/entry-guard-matrix.test.ts
  packages/cli/test/entry-guard-startdaemon.test.ts
  packages/daemon/test/index.test.ts
)

PRODUCT_SECURITY_FILES=(
  "${PRODUCT_ENTRY_FILES[@]}"
  packages/daemon/test/auth-bearer-token.test.ts
  packages/daemon/test/mutation-auth.test.ts
  packages/daemon/test/session-admin-auth-guard.test.ts
  packages/daemon/test/terminal-auth.test.ts
  packages/daemon/test/files-asset-security-headers.test.ts
  packages/cli/test/bin-wrapper.test.ts
)

WF_CORE_FILES=(
  tests/test_openrig_run.py
  tests/test_openrig_manifest.py
  tests/test_openrig_gate.py
  tests/test_openrig_continuity.py
)

WF_SECURITY_FILES=(
  tests/redteam/test_mutation_controls.py
)

log() {
  printf '[openrig:%s] %s\n' "$MODE" "$*"
}

die() {
  printf '[openrig:%s] ERROR: %s\n' "$MODE" "$*" >&2
  exit 2
}

check_product_files() {
  local missing=()
  local file
  for file in "$@"; do
    [[ -f "$ROOT/$file" ]] || missing+=("$file")
  done
  if (( ${#missing[@]} > 0 )); then
    printf '[openrig:%s] ERROR: product test file(s) missing from checkout:\n' "$MODE" >&2
    printf '  %s\n' "${missing[@]}" >&2
    exit 2
  fi
  [[ -x "$ROOT/node_modules/.bin/vitest" ]] \
    || die "vitest is not installed at node_modules/.bin/vitest; run npm ci from $ROOT"
}

run_product_vitest() {
  local label="$1"
  shift
  check_product_files "$@"
  log "$label (${#@} files)"
  (cd "$ROOT" && ./node_modules/.bin/vitest run "$@" --reporter=dot)
}

# Resolve the optional external checkout. Never infer a sibling path.
# Unset is the only skip state; an explicitly set variable is a strict contract.
resolve_workflow_group() {
  WORKFLOW_GROUP=""
  WORKFLOW_SKIP_REASON=""
  if [[ -z "${OPENRIG_WORKFLOW_GROUP+x}" ]]; then
    WORKFLOW_SKIP_REASON="OPENRIG_WORKFLOW_GROUP is not set (optional external lane)"
    return 1
  fi
  WORKFLOW_GROUP_EXPLICIT=1
  local configured="${OPENRIG_WORKFLOW_GROUP}"
  if [[ ! -d "$configured" ]]; then
    die "OPENRIG_WORKFLOW_GROUP=$configured is not a directory; unset it to skip the optional external lane"
  fi
  WORKFLOW_GROUP="$(cd "$configured" && pwd)"
  return 0
}

resolve_workflow_python() {
  local group="$1"
  WORKFLOW_PYTHON=""
  WORKFLOW_PYTHON_SKIP_REASON=""
  local configured="${OPENRIG_WORKFLOW_GROUP_PYTHON:-python3}"
  local message=""
  if ! command -v "$configured" >/dev/null 2>&1; then
    message="OPENRIG_WORKFLOW_GROUP_PYTHON=$configured is not executable; install pytest or unset OPENRIG_WORKFLOW_GROUP to skip the external lane"
    if [[ "$WORKFLOW_GROUP_EXPLICIT" == "1" ]]; then die "$message"; fi
    WORKFLOW_PYTHON_SKIP_REASON="$message"
    return 1
  fi
  WORKFLOW_PYTHON="$(command -v "$configured")"
  if ! "$WORKFLOW_PYTHON" -c 'import pytest' >/dev/null 2>&1; then
    message="$WORKFLOW_PYTHON cannot import pytest; install pytest or unset OPENRIG_WORKFLOW_GROUP to skip the external lane"
    if [[ "$WORKFLOW_GROUP_EXPLICIT" == "1" ]]; then die "$message"; fi
    WORKFLOW_PYTHON_SKIP_REASON="$message"
    return 1
  fi
  if ! (cd "$group" && "$WORKFLOW_PYTHON" -c 'import pytest') >/dev/null 2>&1; then
    message="$WORKFLOW_PYTHON cannot import pytest from workflow-group $group; check the interpreter or unset OPENRIG_WORKFLOW_GROUP to skip the external lane"
    if [[ "$WORKFLOW_GROUP_EXPLICIT" == "1" ]]; then die "$message"; fi
    WORKFLOW_PYTHON_SKIP_REASON="$message"
    return 1
  fi
  return 0
}

run_workflow_files() {
  local group="$1"
  local python="$2"
  local label="$3"
  shift 3
  local present=()
  local missing=()
  local file
  for file in "$@"; do
    if [[ -f "$group/$file" ]]; then
      present+=("$file")
    else
      missing+=("$file")
    fi
  done
  if (( ${#missing[@]} > 0 )); then
    if [[ "$WORKFLOW_GROUP_EXPLICIT" == "1" ]]; then
      die "workflow-group checkout is incomplete: missing test file(s): ${missing[*]}; unset OPENRIG_WORKFLOW_GROUP to skip the external lane"
    fi
    log "SKIP $label: missing test file(s): ${missing[*]}"
  fi
  if (( ${#present[@]} == 0 )); then
    if [[ "$WORKFLOW_GROUP_EXPLICIT" == "1" ]]; then
      die "workflow-group checkout is incomplete: no test files present for $label; unset OPENRIG_WORKFLOW_GROUP to skip the external lane"
    fi
    log "SKIP $label: no test files present"
    return 0
  fi
  log "$label (${#present[@]} files)"
  (cd "$group" && "$python" -m pytest "${present[@]}" -q --import-mode=importlib)
}

run_optional_workflow() {
  local include_redteam="$1"
  if ! resolve_workflow_group; then
    log "SKIP workflow-group tests: $WORKFLOW_SKIP_REASON"
    return 0
  fi
  if ! resolve_workflow_python "$WORKFLOW_GROUP"; then
    log "SKIP workflow-group tests: $WORKFLOW_PYTHON_SKIP_REASON"
    return 0
  fi
  run_workflow_files "$WORKFLOW_GROUP" "$WORKFLOW_PYTHON" "workflow-group core" "${WF_CORE_FILES[@]}"
  if [[ "$include_redteam" == "true" ]]; then
    run_workflow_files "$WORKFLOW_GROUP" "$WORKFLOW_PYTHON" "workflow-group redteam" "${WF_SECURITY_FILES[@]}"
  fi
}

run_fast() {
  run_product_vitest "product fast: entry guard" "${PRODUCT_ENTRY_FILES[@]}"
  run_optional_workflow false
}

run_security() {
  run_product_vitest "product security: entry guard and auth/mutation" "${PRODUCT_SECURITY_FILES[@]}"
  run_optional_workflow true
}

run_full() {
  log "product full: explicit CI/release only"
  (cd "$ROOT" && npm test)
  (cd "$ROOT" && npm run test:ui)
}

case "$MODE" in
  fast)
    run_fast
    ;;
  security)
    run_security
    ;;
  workflow)
    run_optional_workflow true
    ;;
  full)
    run_full
    ;;
  cert)
    echo "certification is run-specific: use the frozen CERT harness, not this script" >&2
    exit 2
    ;;
  *)
    echo "usage: $0 {fast|security|workflow|full|cert}" >&2
    exit 2
    ;;
esac
