# Pi conventions

Read this when setting up a skill, choosing where it loads, changing frontmatter,
or explaining validation and distribution. These conventions were checked against
Pi 1.1.0's bundled `docs/skills.md`, `docs/settings.md`, `docs/configuration.md`,
`docs/cli.md`, and `docs/packages.md`. If the installed version differs or behavior
is uncertain, inspect its corresponding documentation before relying on a claim.

## Choose the resource and location

Prefer a directory containing `SKILL.md`. Use only resources the workflow needs:

```text
skill-name/
├── SKILL.md
├── references/    # Optional, conditionally loaded detail
├── scripts/       # Optional, executable helpers
└── assets/        # Optional, output resources
```

Common discovery locations:

- User: `~/.pi/agent/skills/`, or `skills/` under a custom
  `PI_CODING_AGENT_DIR`.
- Project: `.pi/skills/` under the working directory; project resources are
  subject to trust.
- Agent Skills locations: `~/.agents/skills/` and project `.agents/skills/`.
  Pi searches project `.agents/skills/` from the working directory through its
  ancestors, stopping at the repository root when one exists.
- Explicit paths in the `skills` settings array, `--skill <path>`, or Pi packages.

A repository's ordinary `skills/` directory is not necessarily discoverable just
because the agent is working in that repository. Check its installer, configured
paths, or package registration. Do not expand an approved skill-directory change
into installer edits without approval.

Pi recursively finds skill roots. Stage unapproved drafts outside discovery
roots, for example `~/.pi/agent/drafts/skills/<name>/`, only after confirming that
path is not itself configured as a resource. Do not rely on a `drafts` name to
hide a draft. `disable-model-invocation: true` prevents automatic model selection;
it does not make a discovered skill unavailable through explicit invocation.

## Frontmatter

A portable minimal file starts with:

```yaml
---
name: example-workflow
description: Perform a specific reusable workflow. Use when the user requests its concrete task or outcome.
---
```

- Use a non-empty name of at most 64 characters: lowercase letters, digits, and
  single hyphens, with no leading, trailing, or consecutive hyphens.
- Match the directory name for portability. Pi itself neither requires nor warns
  about a mismatch; other implementations may enforce it.
- Use a non-empty description of at most 1024 characters. It is routing metadata,
  not a generic summary. Avoid catch-alls such as “use whenever skills are
  mentioned.” Quote YAML values when needed to prevent parsing ambiguity.
- Omit `disable-model-invocation` for ordinary automatic selection. Set it to the
  boolean `true` for explicit-only `/skill:name` use.
- Add `license` when useful, with accurate notices for adapted material.
- Add `compatibility` only for actual environment requirements; keep it within
  the Agent Skills specification's 500-character limit.
- Add `metadata` only when it serves a concrete consumer.
- `allowed-tools` is experimental. Do not use it as a permission grant, tool
  installer, or substitute for the session's approval rules.

Pi advertises each automatically selectable skill's name, description, and
path. The full instructions are read when relevant. Loading is model-mediated,
not guaranteed. Reference supporting files relative to the skill directory and
state when to read them; use the same base for scripts and assets.

## Validate and load

Check frontmatter and referenced resources first. Inspect Pi's loading diagnostics
for the intended location. Malformed skill files and declared skills without a
description are not loaded; many other invalid fields only produce warnings.
Name collisions keep the first discovered skill and produce a warning.

For a non-persistent interactive trial from the repository root:

```bash
pi --skill ./skills/skill-authoring
```

This starts a session with an explicit skill path; it does not write an install
entry. It still runs in the current project's environment, not a sandbox. For
other skills, substitute their actual paths. Once discoverable, use:

```text
/reload
/skill:skill-authoring Review the skill at <path> without editing it.
```

`enableSkillCommands` controls command discovery; manually entered `/skill:name`
commands still work. Reload refreshes resources for the active session; it does
not install an unregistered directory or guarantee automatic triggering.

Report separately whether format/resource checks, discovery, explicit invocation,
and automatic selection were verified. A loader check alone proves none of the
skill's behavioral outcomes.

## Distribution

Prefer the existing repository/package conventions rather than a new framework.
A Pi package can expose skills through `package.json`:

```json
{
  "name": "example-skills",
  "keywords": ["pi-package"],
  "pi": { "skills": ["./skills"] }
}
```

Manifest paths resolve from the package root. Declare actual runtime dependencies
in the package, not as unexplained setup assumed by the skill. A package can also
contain executable extensions, so inspect its full selected contents before
installation. Obtain approval before installing, changing user configuration,
or publishing; none follows automatically from authoring the skill.
