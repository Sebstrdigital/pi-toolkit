# Retention and removal inventory

*Classification snapshot: 2026-10-12. “Candidate” means review later; it does
not authorize deletion, movement, archival, installation, reload, backup,
commit, or `.gitignore` changes. Missing from a host loadout does not mean
unused.*

## Measured audit inventory

The lead's read-only audit counted regular files/byte totals, not Git ownership
or allocated disk space unless stated otherwise:

| Path/class | Regular files | Bytes | Interpretation |
| --- | ---: | ---: | --- |
| `docs/delivery/` | 20,893 | 225,984,065 | Retained execution evidence, snapshots, and caches; largest source of audit volume. |
| `docs/workflows/` | 411 | 10,051,527 | Plans, retrospectives, source-capability records, and first-release evidence. |
| `node-compile-cache/` | 99 | 3,398,132 | Derived cache candidate, not a deletion instruction. |
| `extensions/` | 11 | 77,338 | Current extension source. |
| `skills/` | 32 | 126,851 | Current skill/source material. |
| `vendor/` | 81 | 852,587 | Pinned/reference source, licenses, and provenance. |

The source/docs/delivery audit total was 265 MB allocated on this host versus
225,984,065 regular-file bytes; do not conflate allocated space with file bytes.
A nested `docs/delivery/autonomous-delivery-activation/compile-cache/` was
observed at 1,776 files / 13,836,373 bytes, alongside many per-attempt caches.
These measurements are a 2026-10-12 observation, not a retention policy.

## Keep as current repository material

| Class | Examples | Reason / source |
| --- | --- | --- |
| Source and tests | `extensions/`, `scripts/`, `skills/`, `tests/`, `install.sh`, `agent/`, `agents/` | Current capability, installer, and verification surface. |
| Current guides | root `README.md`, `docs/README.md`, `docs/lean-workflows.md`, `docs/delivery-workflow.md`, `docs/execution-service.md` | Current navigation and source-facing policy. |
| Vendor and provenance | `vendor/`, licenses, provenance, accepted patches | Reproducibility, license, and rollback context. |
| Outcomes and rollback records | `docs/workflows/`, `docs/delivery/`, retained task handoffs | Historical evidence and recovery context; see [maintenance index](README.md). |
| Compatibility transport | `scripts/delivery-agent.ts`, `extensions/delivery-worker/` | Still supported/installed compatibility, not unused merely because tmux exists. |
| Intentional shielding | empty `AGENTS.override.md` | Current dependency that shields inherited Claude context; do not infer emptiness means disposable. |

## Observed source versus host/loadout categories

| Category | Inventory treatment |
| --- | --- |
| Repository source | Keep unless a separate scoped change supersedes it. Accepted capabilities are currently dirty/untracked; that is a reproducibility finding, not permission to stage/commit them. |
| Personal observed symlinks | Installation evidence only; targets observed for delivery-tmux, delivery-worker, lean-progress, one-pager and toolkit skills. Do not alter host links in housekeeping. |
| Current host loadout | A time-bound observation, not repository ownership or proof that a source is unused. |
| Opt-in capabilities | Keep source and activation docs; absence from default installation is intentional. |
| Compatibility capabilities | Keep while a documented caller/installer support path remains. |
| Vendor/reference-only material | Keep source, license, and provenance; do not treat it as a discoverable runtime feature. |
| Evidence/caches | Retain evidence pending owner/reference/rollback review; classify disposable cache separately. |

The external `diagram-design` skill is not toolkit-owned. The local
`skill-authoring` source is present but was not observed as installed. Neither
observation requests installation or removal.

## Cleanup and reproducibility candidates — gated, no action now

| Candidate | Why it needs a later decision | Required gates before any later action |
| --- | --- | --- |
| Reproducible accepted-source baseline | Current accepted source capabilities are dirty/untracked, and a personal symlink does not make a clean clone reproducible. | Identify owner, intended tracked source/evidence boundary, provenance, clean-clone checks, and release decision. No staging/commit in housekeeping. |
| `.gitignore` policy for derived caches | Could prevent regeneration artifacts from obscuring source state, but may accidentally hide useful evidence. | Complete source/evidence/cache classification; confirm ignored patterns, references, reproducibility, backup/rollback, and no active run. |
| `.DS_Store` files | Finder metadata, not source. | Confirm repository ownership/ignore policy and no task evidence reliance. |
| `node-compile-cache/` and per-attempt compile caches | Regenerable derived data. | Confirm no active run, no reference from retained evidence, cache scope, and backup/rollback need. |
| Raw logs, snapshots, transcripts, and old status files under `docs/delivery/` or `docs/workflows/` | May be archival rather than active material. | Identify owner, incoming references, provenance/rollback value, retention policy, and backup before proposing move/archive. |
| Historical implementation/activation directories | May contain duplicated evidence and old defaults. | Verify superseding disposition, references, owner, and recovery value; preserve accepted outcome records. |

No class above is a blanket cleanup queue. In particular, do not delete a file
because it is untracked, uninstalled, old, or absent from the current host.

## Evidence basis and limits

This inventory uses the 2026-10-12 housekeeping audit's observed repository
counts, symlink targets, host-loadout observations, and current source
navigation. It does not rescan private settings/sessions, prove backup status,
or claim a filesystem item is unreferenced.
