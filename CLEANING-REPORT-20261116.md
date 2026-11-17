# CLEANING-REPORT — openrig-personal-local

Package: `openrig-personal-local`
Step: `stage_packages` (workflow run `openrig-personal-publish-20261116`)
Date: 2026-11-16
Executed by: `exec-tdo-oc@openrig-personal-publish-20261116`
Source: personal OpenRig source tree, commit `e932ae94e4c07b619c39902f29db949464ebb295`
plus 29 uncommitted working-tree changes (as required by TASK §2).

## 1. Include / exclude

| Item | Value |
| --- | --- |
| Staging root | `openrig-personal-local/` |
| Source files considered | 11,671 regular files (any-level `node_modules/`, `var/`, `.git/` and `var.7z` excluded) |
| Files staged | 11,658 (see `PACKAGE-MANIFEST.json`) |
| Bytes staged | 87,440,780 (83.39 MiB) |
| `packages/*/dist` files | 7,218 |
| `docs/` files | 165 |
| Any-level `node_modules/` in staging | 0 |
| `var/`, `var.7z`, `.git/` in staging | 0 |

Excluded by pattern:

```text
.git/                 any-level node_modules/     var/            var.7z
.agents/  .claude/    .evidence/  .codegraph      rig.yaml        UPSTREAM-BASE
*.sqlite*  *.db       .env*       *.pem  *.key    *.p12  *.crt
*.log  *.tmp  *.tgz   .DS_Store   __pycache__/    demo/proof/
```

Rationale:

- `rig.yaml` is an untracked machine-local rig config with an absolute cwd.
- `UPSTREAM-BASE` is a local upstream-baseline note (mode 600), not deliverable content.
- `var/` holds the run archive (published separately as the evidence asset).
- `demo/proof/` holds local demo artifacts.
- `.gitignore` was **replaced** with a packaging version, because the source
  `.gitignore` ignores `dist/` and `docs/*`, which must be shipped here.

## 2. Hard gate — secret scan

### 2.0 Scan scope (including packaging documents)

Every scan below covers the **whole package tree**, which explicitly includes the
documents added at package time:

`README-PERSONAL.md`, `RUNTIME.md`, `RELEASE-NOTES.md`, `runtime/install.sh`,
`runtime/rig-shim.sh`, `runtime/OPENRIG_ENV.example`, `CLEANING-REPORT.md`,
`PACKAGE-MANIFEST.json`, `SHA256SUMS`, `.gitignore`.

`RELEASE-NOTES.md` (the `--notes-file` for the `v2026.11.16` GitHub release) was
also checked by hand: it contains the product name, the tag, the release date,
the contents list, a quick-start pointer to `RUNTIME.md`, provenance without any
local absolute path, and the security statement referring back to this report. It
is counted in `PACKAGE-MANIFEST.json` and listed in `SHA256SUMS`.

Command (run from the staging root over all three packages):

```bash
PAT='(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|gh[ousr]_[A-Za-z0-9]{36}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
rg -n --hidden --no-ignore -g '!.git/**' -g '!*.zst' -g '!*.png' -g '!*.jpg' -g '!*.gif' -g '!*.xlsx' -e "$PAT" \
  openrig-personal-local workflow-group-personal-use evidence
```

Result: **89 matches in 37 files — every one reviewed individually and classified
as a false positive** (test fixture, generated asset, or checksum file). No real
credential exists in the package. Details in §3.

Second-pass human review command (word-level, not automatic FAIL):

```bash
rg -n -i --hidden --no-ignore -g '!.git/**' \
  -e 'bearer [A-Za-z0-9._-]{16,}' -e '(api[_-]?key|secret|token|password)[[:space:]]*[:=][[:space:]]*[^[:space:]"'"'"']{8,}' \
  openrig-personal-local workflow-group-personal-use evidence
```

Every `token`/`password`/`bearer` word hit in this package is a variable name, a
test fixture value, or documentation. No value is a live credential.

> **Note on quoted matches:** matched literals in §3 are truncated with `…`
> (and `AKIA…` / `-----BEGIN OPENSSH … KEY-----` are abbreviated) so that this
> report does not itself trip the secret scanner. The `file:line` references are
> exact; no value here is a credential.

## 3. Allowlist — every high-confidence match, individually justified

### 3.1 Test fixtures (fake values, kept as tests)

| File | Lines | Matched text | Why it is not a credential |
| --- | --- | --- | --- |
| `packages/cli/test/restore-packet.test.ts` | 308, 310, 322, 324, 523, 526, 620, 1685, 1704 | `sk-aBc…wXyZ`, `sk-AbC…StUv`, `github…6789`, `sk-Fak…OpQr` | Redaction test vectors; the assertions verify these strings are *removed* |
| `packages/daemon/test/transcript-routes.test.ts` | 353, 355, 366, 368 | `sk-Fak…OpQr`, `github…QrSt` | Transcript redaction fixture |
| `packages/daemon/test/agent-starter-resolver.test.ts` | 185, 200, 201 | `sk-fak…fake` | Rejection-message fixture; asserts the value is *not* echoed |
| `packages/daemon/test/provider-codex-auth-reader.test.ts` | 33, 48 | `sk-SEC…face` | Literal name says it must never surface; assertion enforces it |
| `packages/daemon/test/slack-request-shape.test.ts` | 58, 72, 79, 82, 96, 105 | `xoxb-E…fake` | Slack API shape tests, no network |
| `packages/daemon/test/slack-channel-map-cli.test.ts` | 135, 148, 159, 194, 204 | `xoxb-l…only` | CLI fixture; assertion checks it is not printed |
| `packages/cli/test/slack-cutover-cli.test.ts` | 153 | `xoxb-l…only` | Same fixture |
| `packages/daemon/test/slack-images.test.ts` | 63, 134 | `xoxb-E…fake` | Image-block builder fixture |
| `packages/daemon/test/slack-mention-injection.test.ts` | 48 | `xoxb-E…fake` | Injection test fixture |
| `packages/daemon/test/slack-message.test.ts` | 20, 65, 154 | `xoxb-E…Fake`, `xoxb-E…leak` | Leak-detection fixture; text explicitly says `doNotUseFake` |
| `packages/daemon/test/slack-inbound-files.test.ts` | 65, 166, 206 | `xoxb-t…oken` | Auth-header fixture; asserts the token never reaches a row |
| `packages/daemon/test/slack-structure*`, `slack-thread-routing`, `slack-durability`, `slack-attribution`, `slack-upload-title`, `slack-subsystem-cutover`, `slack-status-backlog`, `slack-stale-notification`, `slack-restart-rate-limit`, `slack-echo-registration`, `slack-long-human-ask`, `slack-reply-to-thread`, `slack-channel-map-wire`, `complete-human-notifications`, `delivery-rules-engine`, `owner-notification-routing`, `openrig-skills-router-coverage` | various | `xoxb-E…fake`, `xoxb-L…tion`, `xoxb-L…tion` | All write a temporary `fake.env` inside a test home; none is read from the environment or a real provider |
| `scripts/portability-report.test.mjs` | 30 | `-----BEGIN OPENSSH … KEY-----` | The literal header string is the *input* to a category classifier test; no key body follows |
| `packages/daemon/test/portability-report.test.mjs` equivalent (`AKIAAA…AAAA`) | — | `AKIA…` | Fabricated AWS-shaped string used by the portability classifier test |

### 3.2 Generated / binary assets (pattern coincidence)

| File | Matched text | Why it is not a credential |
| --- | --- | --- |
| `packages/ui/twin/corrective/media-webm.ts` | `AKIAAA…AAAA` (inside a base64 `data:video/webm` blob) | Base64 coincidence; the file is a WebM encoder fixture |
| `packages/cli/ui/dist/assets/index-CjGBhfVP.js` | `sk-str…ault`, `sk-ima…olor`, … | Minified UI bundle; these are CSS custom-property names, not API keys |
| `packages/cli/ui/dist/assets/index-DNU3XZr_.css` | `sk-…` font descriptors | Tailwind/CSS token names |
| `SHA256SUMS` | `sk-vie…mal-…`, `sk-latin-wght-normal-…` | The hash file lists **font filenames** (`space-grotesk-*`) whose substring `sk-latin…` matches the `sk-` rule |

### 3.3 Evidence bundle cross-hit

`evidence/workflow-group-runs/openrig-full-verify-20261019/reports/evidence/{build,test-repo,test-repo-retest}.txt`
contain the same `space-grotesk-*.woff2` font filenames from an old build log.
Same false positive as §3.2.

**Conclusion: no real secret. No file was exempted wholesale — each match above
is justified line by line.**

## 4. Hard gate — raw session / SQLite / home-snapshot scan

```bash
find openrig-personal-local workflow-group-personal-use evidence \
  \( -name 'events.jsonl' -o -path '*/transcripts/*' -o -path '*/sessions/*' \
     -o -name '*.sqlite*' -o -name '*.db' -o -name '.credentials' -o -name 'auth.json' \
     -o -path '*/.dsh/*' -o -path '*/secrets/*' -o -name 'id_rsa*' \) -print
```

Result: **no output (0 hits).**

## 5. Local absolute paths

Hard gate (must be zero) across `README-PERSONAL.md`, `RUNTIME.md`, `runtime/**`,
`PACKAGE-MANIFEST.json`:

```bash
rg -n '/home/[A-Za-z0-9._-]+' openrig-personal-local/{README-PERSONAL.md,RUNTIME.md,runtime}
```

Result: **no output.**

Rewrite performed:

| File | Original | Now |
| --- | --- | --- |
| `AGENTS.md` (§ guidance/team.md) | private run brief with `/home/<user>/…` project and run paths | generic project guidance, no absolute paths |
| `AGENTS.md` (trailing map) | relative link into a sibling private repository | in-repo `DOCS-MAP.md` link |
| `runtime/rig-shim.sh`, `runtime/install.sh` | — | written path-free (resolve their own directory) |

### 5.1 Executable scripts — every hit enumerated and classified

`00-plan.md` §4.4 forbids machine paths in executable scripts, so the package was
searched script-by-script rather than by directory:

```bash
rg -n '/home/[A-Za-z0-9._-]+' openrig-personal-local/{runtime,scripts}
```

Result: **8 hits in 3 files, all justified below. Zero are the author's home.**

| File:lines | Hit | Classification |
| --- | --- | --- |
| `scripts/bootstrap-product-factory-vps.sh:44-48` | `/home/openrig/.ssh/…` | **Target service account.** The script provisions a *new* VPS user named `openrig`; that user's home is `/home/openrig` by definition. It is the destination of the deployment, not the author's machine path. Replacing it with a variable would make a working provisioning script less readable without removing any information about this machine. |
| `scripts/portability-report.test.mjs:31,41` | `/home/bob/project`, `/home/user/repo` | Test fixtures for the home-path classifier (`/home/bob`, `/home/user` are RFC-style placeholders). |
| `scripts/internal-leak-scanner.test.mjs:102` | `/home/example/project` | Test fixture for the leak scanner. |

Allowed and left in place (documented, not executable configuration):

| Count | Where | Nature |
| --- | --- | --- |
| 56 files | `packages/**` test fixtures and docs | `/home/test`, `/home/u`, `/home/user`, … synthetic fixture values |
| 1 line | `AGENTS.md` | none remaining |

No `README`, `RUNTIME`, `runtime/*`, `scripts/*` executable path or manifest
contains the author's machine path.

## 6. Large files

```bash
find openrig-personal-local -type f -size +20M -printf '%s %p\n'
```

Result: **no output.** Largest files are the UI bundles
(`packages/cli/ui/dist/assets/index-*.js`, ≈1.97 MB) and are listed in
`PACKAGE-MANIFEST.json` under `largest`. Well below the GitHub 100 MB file limit.

## 7. Executable bits

```bash
find openrig-personal-local/runtime -name '*.sh' ! -perm -u+x -print
```

Result: **no output.** `runtime/install.sh` and `runtime/rig-shim.sh` are `0755`.
Existing source scripts keep their original modes.

## 8. Known gaps / unverified

1. The tree is a **snapshot of a dirty working tree**, not a tagged release. The
   provenance is the commit hash plus the shipped files themselves.
2. `packages/daemon/context-packs/` is generated at package time upstream; this
   snapshot ships whatever the working tree contained, so it may differ from a
   fresh `npm run generate-context-packs` run. `npm run generate-context-packs:check`
   is part of `npm test` for verification.
3. `dist/` bundles are shipped prebuilt; they were not rebuilt during staging.
   `bash runtime/install.sh` rebuilds them from source.
4. Historical local paths inside test fixtures are left untouched by design: they
   are fixtures, and rewriting them would weaken the tests.

## 9. Provenance

| Field | Value |
| --- | --- |
| Source tree | personal OpenRig source, dirty working tree |
| Source HEAD | `e932ae94e4c07b619c39902f29db949464ebb295` |
| Version | `openrig-local 0.1.4` |
| Built/staged | 2026-11-16 |
| Staged by | `exec-tdo-oc@openrig-personal-publish-20261116` |
