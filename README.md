# pi-toolkit

Minimal personal setup for the pi coding agent.

## Contents

- `agent/AGENTS.md`: global approval, evidence, memory, and writing rules.
- `skills/`: debug, grill-me, zoom-out, duadigital-pdf-maker, and
  homelab-validation.
- `AGENTS.override.md`: empty override shielding this repo from its
  Claude-specific context file.

Skills load on demand; zoom-out is explicit-only.
Invoke a skill with `/skill:<name> [request]`.

## Install

```bash
bash install.sh
```

Creates symlinks under `~/.pi/agent/`. Re-running is safe; existing files
or links to other targets are never overwritten. Keep this checkout in place.

The PDF skill requires Google Chrome at its standard macOS application
path. HomeLab validation requires SSH access via `ssh validation`.

Parent-directory overrides at `~/work/AGENTS.override.md` and
`~/work/git/AGENTS.override.md` are machine-local and not installed by
this script. An override replaces AGENTS.md/CLAUDE.md in its own directory.

## History

Reset on 2026-10-06. The old toolkit is preserved under
`pre-reset-2026-10`; nothing from it was restored.

See [docs/pi-fresh-start.md](docs/pi-fresh-start.md) for the original plan.
The current setup keeps global rules under 600 bytes and HomeLab guidance
in an on-demand skill.
