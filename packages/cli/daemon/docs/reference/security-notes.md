# Security notes — host kernel, model files, and the npm dependency floor

> Status: **Shipped operator note.** Point-in-time check: 2026-10-25 on an
> Ubuntu 26.04.1 LTS host running kernel `7.0.0-38-generic`.
> This page records two host-level exposures that OpenRig code cannot fix, plus the
> npm floors this line now enforces. Re-check the versions before relying on it;
> it is a snapshot, not a live scanner.

## What this page is and is not

- It **is** the place an operator or an agent looks before running untrusted work on
  this host, or before loading a model checkpoint into the local ComfyUI install.
- It **is not** a claim that OpenRig audits the host. OpenRig's own dependency floor
  is enforced by `scripts/check-dependency-floors.test.mjs` (see below); the kernel
  and PyTorch items are outside this repository and need an OS/environment action.
- Nothing here is a substitute for the distribution's security tracker. The CVE and
  advisory links are the authority.

## Linux kernel — wait for `7.0.0-43.43`, and do not run untrusted KVM guests before it

Ubuntu 26.04 LTS is marked vulnerable to **CVE-2026-99999** ("PwnEscape"): a memory
corruption in the IPv4 `skb_checksum_help` path that a KVM guest can use to escape to
the host. Ubuntu's fix is work-in-progress in **`7.0.0-43.43`**; as of 2026-10-25 the
`resolute-security`/`resolute-updates` candidate is still `7.0.0-38.38`, so there is no
fixed package to install.

What is true on this host (checked 2026-10-25):

- `uname -r` → `7.0.0-38-generic`; `linux-image-7.0.0-38-generic` is `7.0.0-38.38`.
- `systemd-detect-virt` → `none` (bare metal, not a guest).
- `/dev/kvm` exists and `kvm_intel` is loaded, but no `qemu`/`libvirt` process is running.

Operator rule:

1. **Do not run untrusted code, sandboxes, or third-party VM images inside KVM on this
   host until the fixed kernel is installed.** The escape requires a running guest; the
   practical exposure is the guest workload, not the bare-metal daemon.
2. When `7.0.0-43.43` (or later) reaches the archive, upgrade and reboot:
   `sudo apt update && sudo apt full-upgrade`, then confirm `uname -r` reports the new
   kernel after the reboot.
3. Re-check rather than assume:
   ```bash
   uname -r
   apt-cache policy "linux-image-$(uname -r)"
   systemd-detect-virt
   pgrep -a qemu || true
   ```

The host's ordinary IPv4-exposed surface is a "patch when available" risk, not a reason
to stop the daemon. The deliberate exposure is a guest the operator starts.

## PyTorch model files — do not load `.ckpt`/`.pth`/`.pt` from an untrusted source

**CVE-2026-24747** is a deserialization issue in PyTorch's checkpoint loading, fixed in
**torch 2.10.0**. The local ComfyUI environment has **torch 2.6.0+cu124**, and ComfyUI
calls `torch.load(..., weights_only=True)` at several model-loading sites
(`comfy/utils.py:192`, `comfy/sd1_clip.py:455`, `comfy_extras/nodes_dataset.py:2104`),
which is exactly the path the advisory describes.

What is true on this host (checked 2026-10-25):

- ComfyUI's virtualenv is `~/ComfyUI/.venv` with torch `2.6.0+cu124`.
- `find ~/ComfyUI/models -name '*.ckpt' -o -name '*.pth' -o -name '*.pt'` returned
  **0** files, and ComfyUI listens on `127.0.0.1:8188` only, so no external delivery
  path is currently open.
- The risk is what happens next: downloading a checkpoint from a model-sharing site and
  opening it in the UI.

Operator rule:

1. **Do not load a `.ckpt`, `.pth`, or `.pt` file from an untrusted source** — treat it
   as executable content. Prefer safetensors for weights you did not produce.
2. When the ComfyUI environment is rebuilt, install **torch ≥ 2.10.0**; do not rebuild
   it back onto 2.6.0.
3. Check what is actually installed before running an untrusted model:
   ```bash
   ~/ComfyUI/.venv/bin/python -c "import torch; print(torch.__version__)"
   find ~/ComfyUI/models \( -name '*.ckpt' -o -name '*.pth' -o -name '*.pt' \) -print
   ```
4. A `weights_only=True` call is a mitigation the model loader applies, not a statement
   that the file is safe. The fix is the torch upgrade plus not loading unknown files.

## npm dependency floor (OpenRig's own packages)

The 0.1.4 cut raised two directly reachable runtime dependencies and now guards them:

| Package | Floor | Why it is reachable |
| --- | --- | --- |
| `tar` | `> 7.5.20` (resolved `7.5.22`) | `.rigbundle` pack/unpack in `packages/daemon/src/domain/bundle-archive.ts`. The digest check, path pre-scan, and extraction filter stop path traversal, but the archive parser itself still parses the bundle. |
| `hono` | `>= 4.13.11` (resolved `4.13.13`) | The daemon's HTTP router (`packages/daemon/src/server.ts`). |
| `@hono/node-server` | `> 1.19.14` (resolved `1.19.17`) | The Hono Node adapter used by the daemon and CLI. |
| `@modelcontextprotocol/sdk` | `> 1.31.0` (resolved `1.32.2`) | The CLI's MCP stdio server. |
| `zod` | `>= 4.6.6` (resolved `4.6.7`) | MCP tool input validation. |
| `smol-toml` | `> 1.8.0` (resolved `1.9.1`) | Provider auth and Codex configuration parsing. |
| `postcss` / `vite` | `> 8.5.22` / `> 6.4.3` (resolved `8.5.31` / `6.4.5`) | UI build only; not loaded by the daemon. |

`scripts/check-dependency-floors.test.mjs` reads the lockfile and the workspace manifests
and fails `npm run test:repo` if a later install resolves any guarded package below its
floor or re-admits an old range.

### Audit triage policy for this line

- Run `npm audit --json`; treat **critical/high in a runtime path** as blocking.
- Use `npm audit fix` **without `--force`**. A major upgrade of an unrelated dependency
  is a separate decision, not something an audit run gets to make.
- dev-only and build-time findings may stay when the only fix is a major test-infra or
  UI-toolchain migration; record the reason in the round report instead of hiding it.
- After the 0.1.4 update, the remaining audit findings are 2 critical and 4 moderate, all
  dev-only (`vitest`/`tinypool`/`@vitest/mocker`) or Tailwind 3 build-time
  (`tailwindcss`/`postcss-nested`/`postcss-selector-parser`). No high/critical remains
  in a daemon or CLI runtime path; see `runs/openrig-r23-deps/reports/01-dependency-upgrade.md`
  in the workflow workspace for the item-by-item table.

## References

- CVE-2026-99999 (PwnEscape): Ubuntu CVE tracker for the 26.04 kernel.
- CVE-2026-24747 (PyTorch): the upstream advisory and the 2.10.0 fix.
- tar advisories: GHSA-vmf3-w455-68vh, GHSA-w8wr-v893-vjvp, GHSA-23hp-3jrh-7fpw,
  GHSA-8x88-c5mf-7j5w, GHSA-gvwx-54wh-qm9j, GHSA-r292-9mhp-454m.
- hono advisories: GHSA-r5rp-j6wh-rvv4 and the 4.13.x batch listed by `npm audit`.
