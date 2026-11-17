# CLEANING-REPORT — openrig-personal-execution

Package: `openrig-personal-execution`
Step: `build_public_execution_package` (workflow run `openrig-s10-solution-20261118`)
Date: 2026-11-18
Executed by: `public-exec-builder` (task-15)
Source: personal OpenRig source tree, clean tracked HEAD `8a7b8e00e48f4a7aa0a47e03336705c45b5aef23`
(`chore(openrig): snapshot S10 remediation and current source worktree`) plus the
current product worktree content. The only untracked source entries at build time were the
excluded `var/openrig-remediation-evidence/` and `var/openrig-review-s10-20261118/` trees;
there was no tracked source diff.

## 1. Include / exclude

| Item | Value |
| --- | --- |
| Source rsync entries | 12,735 (regular 11,784, links 5, dirs 946) |
| Source bytes (dry-run total) | 91,350,244 |
| Final package files (manifest count) | 11802 |
| Final package bytes (manifest count) | see `PACKAGE-MANIFEST.json` |
| `packages/*/dist` files | 4034 |
| `packages/cli/dist` files | 751 |
| `docs/` files | 166 |
| Any-level `node_modules/` in final tree | 0 |
| `var/`, `var.7z`, `.git/` in final tree | 0 |

The final tree was produced by an `rsync -a --delete` from the current product tree
with the exclusion set below, then restoring the package-only files from the prior
public clone. Package-only files preserved unchanged:

```text
README-PERSONAL.md  README-UPSTREAM.md  README.md  RUNTIME.md
RELEASE-NOTES.md  STACK.json  .gitignore  AGENTS.md  runtime/
```

Excluded by pattern:

```text
.git/
node_modules/
var/
var.7z
.venv/
.pytest_cache/
.r7-work/
.omo/
.locks/
.agents/
.claude/
.evidence/
.codegraph
/rig.yaml
UPSTREAM-BASE
*.sqlite*
*.db
.env*
*.pem
*.key
*.p12
*.crt
*.log
*.tmp
*.tgz
.DS_Store
__pycache__/
*.pyc
demo/proof/
TEST-REFACTOR.md
/README-PERSONAL.md
/README-UPSTREAM.md
/README.md
/RUNTIME.md
/RELEASE-NOTES.md
/STACK.json
/.gitignore
/runtime/
/AGENTS.md
/CLEANING-REPORT.md
/CLEANING-REPORT-20261116.md
/PACKAGE-MANIFEST.json
/SHA256SUMS
```

Package-only paths were also excluded from rsync so the source tree could not
overwrite them: `README-PERSONAL.md`, `README-UPSTREAM.md`, `README.md`, `RUNTIME.md`,
`RELEASE-NOTES.md`, `STACK.json`, `.gitignore`, `runtime/`, `AGENTS.md`,
`CLEANING-REPORT.md`, `CLEANING-REPORT-20261116.md`, `PACKAGE-MANIFEST.json`, and
`SHA256SUMS`.

The prior package report is preserved as `CLEANING-REPORT-20261116.md`; the
generated report is this file.

## 2. Hard gate — secret scan

Command (whole final tree; excludes the clone's `.git` and binary image/sheet files):

```bash
PAT='(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|gh[ousr]_[A-Za-z0-9]{36}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
rg -n --hidden --no-ignore -g '!.git/**' -g '!*.zst' -g '!*.png' -g '!*.jpg' -g '!*.gif' -g '!*.xlsx' -e "$PAT" .
```

Result on the final tree: **81 matches in 37 files — all false positives.**
No live credential is present. The matches are provider-shaped test fixtures, generated
minified/UI assets, a Base64 WebM fixture, and font filenames in `SHA256SUMS`. File-level
inventory (matches, not values):

| File | Matches |
|---|---|
| ./packages/cli/test/restore-packet.test.ts | 9 |
| ./SHA256SUMS | 6 |
| ./packages/daemon/test/slack-request-shape.test.ts | 6 |
| ./packages/cli/test/slack-channel-map-cli.test.ts | 5 |
| ./packages/daemon/test/transcript-routes.test.ts | 4 |
| ./packages/daemon/test/agent-starter-resolver.test.ts | 3 |
| ./packages/daemon/test/delivery-rules-engine.test.ts | 3 |
| ./packages/daemon/test/owner-notification-routing.test.ts | 3 |
| ./packages/daemon/test/slack-inbound-files.test.ts | 3 |
| ./packages/daemon/test/slack-message.test.ts | 3 |
| ./packages/cli/ui/dist/assets/index-CjGBhfVP.js | 2 |
| ./packages/daemon/test/provider-codex-auth-reader.test.ts | 2 |
| ./packages/daemon/test/slack-channel-map-wire.test.ts | 2 |
| ./packages/daemon/test/slack-file-download.test.ts | 2 |
| ./packages/daemon/test/slack-images.test.ts | 2 |
| ./packages/daemon/test/slack-reply-to-thread.test.ts | 2 |
| ./packages/daemon/test/slack-structured-questions.test.ts | 2 |
| ./packages/daemon/test/slack-thread-routing.test.ts | 2 |
| ./packages/ui/dist/assets/index-CjGBhfVP.js | 2 |
| ./packages/cli/test/slack-cutover-cli.test.ts | 1 |
| ./packages/cli/ui/dist/assets/index-DNU3XZr_.css | 1 |
| ./packages/daemon/test/complete-human-notifications.test.ts | 1 |
| ./packages/daemon/test/openrig-skills-router-coverage.test.ts | 1 |
| ./packages/daemon/test/slack-attribution.test.ts | 1 |
| ./packages/daemon/test/slack-durability.test.ts | 1 |
| ./packages/daemon/test/slack-echo-registration.test.ts | 1 |
| ./packages/daemon/test/slack-long-human-ask.test.ts | 1 |
| ./packages/daemon/test/slack-mention-injection.test.ts | 1 |
| ./packages/daemon/test/slack-restart-rate-limit.test.ts | 1 |
| ./packages/daemon/test/slack-stale-notification.test.ts | 1 |
| ./packages/daemon/test/slack-status-backlog.test.ts | 1 |
| ./packages/daemon/test/slack-subsystem-cutover.test.ts | 1 |
| ./packages/daemon/test/slack-upload-title.test.ts | 1 |
| ./packages/ui/dist/assets/index-DNU3XZr_.css | 1 |
| ./packages/ui/twin/corrective/media-webm.ts | 1 |
| ./scripts/openrig-archive.test.mjs | 1 |
| ./scripts/portability-report.test.mjs | 1 |

Second-pass word-level scan (not an automatic failure; every hit reviewed):

```bash
rg -n -i --hidden --no-ignore -g '!.git/**' \
  -e 'bearer [A-Za-z0-9._-]{16,}' \
  -e '(api[_-]?key|secret|token|password)[[:space:]]*[:=][[:space:]]*[^[:space:]"'"'"']{8,}' .
```

Result: **1070 candidate lines in 430 files.** They are variable
names, test fixtures, documentation, and generated assets; no value is a live
credential. The line-level values are intentionally not copied into this report.

## 3. Hard gate — raw session / SQLite / home snapshot

```bash
find . -path './.git' -prune -o \
  \( -name 'events.jsonl' -o -path '*/transcripts/*' -o -path '*/sessions/*' \
     -o -name '*.sqlite*' -o -name '*.db' -o -name '.credentials' -o -name 'auth.json' \
     -o -path '*/.dsh/*' -o -path '*/secrets/*' -o -name 'id_rsa*' \) -print
```

Result: **0 hits (no output).** No raw transcript, session directory,
SQLite database, credential file, or home snapshot is shipped.

## 4. Local absolute paths

Hard gate over package docs, runtime, and sanitized agent guidance:

```bash
rg -n '/home/[A-Za-z0-9._-]+' README-PERSONAL.md RUNTIME.md runtime AGENTS.md
```

Result: **0 hits (no output).**

Executable/scripts inventory (allowed only when the path is a documented target/fixture,
not the author's home):

```bash
rg -n '/home/[A-Za-z0-9._-]+' runtime scripts
```

Result: **8 hits in 3 files**, all documented
below. None is the author's home path or a launch command for this machine.

| File:line | Hit (truncated) |
|---|---|
| scripts/portability-report.test.mjs | 31:  assert.deepEqual(categories("see /home/bob/project"), ["Home path"]); |
| scripts/portability-report.test.mjs | 41:    "cd /home/user/repo", |
| scripts/bootstrap-product-factory-vps.sh | 44:install -d -m 0700 -o openrig -g openrig /home/openrig/.ssh |
| scripts/bootstrap-product-factory-vps.sh | 45:grep -qF "$AUTHORIZED_KEY" /home/openrig/.ssh/authorized_keys 2>/dev/null \ |
| scripts/bootstrap-product-factory-vps.sh | 46:  || echo "$AUTHORIZED_KEY" >> /home/openrig/.ssh/authorized_keys |
| scripts/bootstrap-product-factory-vps.sh | 47:chown openrig:openrig /home/openrig/.ssh/authorized_keys |
| scripts/bootstrap-product-factory-vps.sh | 48:chmod 0600 /home/openrig/.ssh/authorized_keys |
| scripts/internal-leak-scanner.test.mjs | 102:    line.replace("<launch cwd>", "/home/example/project"), |

Source test fixtures elsewhere retain synthetic `/home/test`, `/home/user`, `/home/example`
strings by design; rewriting them would weaken the tests. No README, `RUNTIME.md`,
`runtime/*`, or manifest contains an author home path.

## 5. Large files and executable bits

```bash
find . -path './.git' -prune -o -type f -size +20M -printf '%s %p\n'
```

Result: **no output.** No file reaches the 20 MB manifest warning threshold.

```bash
find runtime -name '*.sh' ! -perm -u+x -print
```

Result: **no output.** `runtime/install.sh` and `runtime/rig-shim.sh` are modes 0775.

## 6. PACKAGE-MANIFEST / SHA256SUMS

`PACKAGE-MANIFEST.json` records:

| Field | Value |
| --- | --- |
| `package` | `openrig-personal-execution` |
| `version` | `0.1.4` |
| `fileCount` | 11802 |
| `bytes` | see `PACKAGE-MANIFEST.json` |
| `sha256Manifest` | `SHA256SUMS` |
| `sha256ManifestLines` | 11802 |
| `largest` | see PACKAGE-MANIFEST.json |

`SHA256SUMS` contains one `sha256  relative/path` line for every package file except
`PACKAGE-MANIFEST.json` and `SHA256SUMS`; the line count equals `fileCount`, and the
manifest byte total equals the sum of the listed file sizes.

## 7. Known gaps / unverified

1. This is a source snapshot of the personal product worktree at commit
   `8a7b8e00e48f4a7aa0a47e03336705c45b5aef23`, not a tagged upstream release.
   The product worktree had no tracked diff; only the excluded `var/` evidence trees
   were untracked.
2. `dist/` bundles are shipped prebuilt from the source tree; they were not rebuilt
   during packaging. `runtime/install.sh` rebuilds them from source.
3. Package-only docs preserved from the prior public clone (`README-PERSONAL.md`,
   `RUNTIME.md`, `RELEASE-NOTES.md`, `AGENTS.md`) retain their prior package wording
   and date where applicable; they were intentionally not rewritten by this task.
4. Synthetic home paths and credential-shaped test fixtures remain in source tests by
   design; they are not executable configuration and are classified above.
5. No npm install or dependency-container build was run during packaging.

## 8. Provenance

| Field | Value |
| --- | --- |
| Source track | personal OpenRig product worktree |
| Source HEAD | `8a7b8e00e48f4a7aa0a47e03336705c45b5aef23` |
| Source HEAD subject | `chore(openrig): snapshot S10 remediation and current source worktree` |
| Source tracked diff | empty |
| Source untracked | excluded `var/openrig-remediation-evidence/`, `var/openrig-review-s10-20261118/` |
| Version | `openrig-local 0.1.4` |
| Built | 2026-11-18 (local time) |
| Prior report | `CLEANING-REPORT-20261116.md` |

## 9. Post-QA amendment (2026-11-18)

Independent QA found that `scripts/openrig-test-entry.test.mjs` failed in a
dependency-free checkout: the `security` lane refuses before the workflow-group
check when `node_modules/.bin/vitest` is absent. The test now skips that one
negative case with an explicit reason; all other cases still run. The source
test was fixed and the public snapshot was amended. Run `npm ci` (or
`runtime/install.sh`) to execute the full gate with vitest present.
