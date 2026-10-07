# Pinned progress and quiet display

Explicit opt-in (Node >=22.19 and installed Pi required; tested loader Pi 1.0.4):

```sh
bash install.sh --with-progress --hide-thinking
# May combine with --with-delivery-tmux; neither option is default.
```

No network, npm scripts or peer installations occur. Exactly one guarded
controller is symlinked as `~/.pi/agent/extensions/lean-progress`. Its reviewed,
lossless @pify/todo 0.3.0 source, MIT license, pin and file hashes live in
`vendor/pify-todo/{PROVENANCE.md,LICENSE,INTEGRITY.json}`. The bundled skill is
excluded (skills: []); never also register the upstream package or its extension.
The shim rejects known todo tools and /todos at session_start before activation;
installer rejects known duplicate package/resource registrations and progress
names. Unrelated packages, extensions and mappings remain untouched. Project
resources and arbitrary hidden widget/state-key owners still require review.
A runtime collision is an error, not a reason to disable another controller.

## Authority and use

Use `todo_write({items:[...]})` for meaningful multi-step work. Every write is
FULL replacement. Team's durable Plan is authority; the lead projects accepted
as completed, active as in_progress, pending as pending. Blocked, paused,
cancelled and abandoned remain pending with explicit `[blocked] reason`,
`[paused] reason`, `[cancelled] reason`, `[abandoned] reason` content. Keep at most
one active row; zero is allowed when no work is active (blocked, paused, or finished). Worker completion never means acceptance. Children have no independent
list. Default scratch lists need no Plan for trivial work; no automatic Plan
parser, evidence gate or scheduler is added. Reconcile from the applicable Plan
on resume/branch/reload before updating. Never remove unresolved rows merely to
make the counter say done. `/todos` shows full retained text; `/todos next` finds
the active/next pending row; `/todos clear` clears only the view cache.

30-row cap; malformed rows drop/default with warnings. Inspect warnings and
reconcile the Plan rather than silently losing scope. The ten-row window follows
the active row. Content truncates after 44 UTF-16 units, so put labels first and
use `/todos` for full reasons. Host Text wraps narrow/wide Unicode safely but the
box is fixed width, not a responsive custom dashboard.

Snapshots replay current full branch on startup/tree. Compaction and summarized
tree events send one hidden restore message on the next turn. Reload after
compaction preserves snapshots/widget, NOT the transient restoration flag; the
lead reconciles manually. Switching unsummarized branches while restoration is
pending restores the CURRENT list. These mock/loader checks do not prove live
provider/TUI behavior, personal readiness or subjective usability; fresh lead
validation and independent review remain mandatory.

`--hide-thinking` changes only hideThinkingBlock:true, preserving unrelated
settings bytes and all models/providers/reasoning/trust/auth values. Ctrl+T
controls thinking visibility and Ctrl+O expands tool detail. Meaningful findings,
decisions, blockers and completion remain visible. No reduced reasoning claim.

## Backups, conservative conflicts and rollback

All affected links, parent directories and optional settings are preflighted
before mutations. Unknown files/directories/dangling links fail rather than being
replaced. Existing exact toolkit symlinks and delivery alias stay unchanged.
Malformed settings fail. A repeat with no changes leaves settings bytes and
backup count unchanged. Each changing install prints a private mode-700
`~/.pi/agent/toolkit-backup-<unique>` containing manifest.json (new exact links,
root, settings flags) and, if settings changed and existed, a permission-preserved
byte-exact settings.json backup. No credentials are read or copied separately;
settings backups are private, outside git. Keep backups for the trial.

Installation is sequential, NOT globally transactional. Filesystem failures or
concurrent edits can interrupt it after preflight. Do not reload a live session
during install; investigate the printed manifest if interrupted. Before rollback,
inspect current mappings/settings for intervening changes. With exact authority,
unlink ONLY each manifest newLinks target still pointing to its recorded source;
never remove a directory or changed mapping. Leave pre-existing links untouched.
If settingsChanged, restore the backup ONLY after confirming no unrelated
concurrent settings edits (merge out hideThinkingBlock instead if there were).
If settingsExisted was false, remove the created settings file only if it still
contains exactly the installer-created setting. Preserve backup permissions and
retain the manifest. Do not delete backups or unknown files as rollback. Exact
personal backup paths and actual trial outcomes are lead annotations, not invented
here. No personal installation or active-session reload was performed by builder.
