# pi-chains

Pi extension that runs YAML-defined chains of role skills sequentially, piping each step's output into the next as `$INPUT`. Roles come from [pi-roles](../pi-roles/) (or any pi-discoverable skill directory).

## Commands

| Command | Purpose |
|---|---|
| `/chain-list` | List discovered chains and their step flow. Marks roles missing from `~/.pi/agent/skills/` with `(?)`. |
| `/chain-run <name> <prompt>` | Run a chain end-to-end. Streams per-step status notifications. |
| `/chain-resume <session-id>` | Stub. Resume support pending. |

## Chain YAML format

```yaml
name: plan-build-review
description: Standard implementation chain
steps:
  - role: scout
    prompt: "$ORIGINAL"
  - role: architect
    prompt: |
      Original task: $ORIGINAL

      Scout findings:
      $INPUT
  - role: builder
    prompt: |
      Approach:
      $INPUT

      Original task: $ORIGINAL
```

**Variables:**
- `$ORIGINAL` — prompt passed to `/chain-run`
- `$INPUT` — previous step's final output
- `$STEP[N]` — output of step N (1-indexed) for non-linear flows

**Per-step model override (optional):**
```yaml
- role: reviewer
  model: gpt-4o
  provider: openai
  prompt: "..."
```

If `model` and `provider` are both set, the spawner passes `--model <provider>/<model>`. With only `model`, it passes `--model <model>` raw. Omit both to inherit pi's currently active model.

## Chain discovery

Loaded in this order (later names override earlier ones):

1. `<extension>/examples/` — defaults shipped with this extension
2. `~/.pi-chains/chains/` — user global
3. `<cwd>/.pi-chains/chains/` — project local

## Spawn pattern

Per step, pi-chains shells out:

```
pi --mode json -p \
   --no-extensions \
   --thinking off \
   --skill <abs path to role SKILL.md> \
   --tools <csv from skill's allowed-tools> \
   --session <chain-session-file> \
   [--model <provider/id>] \
   "<rendered prompt>"
```

Tool restriction is enforced at the CLI (`--tools`) — pi's `allowed-tools` skill frontmatter is currently experimental and lenient, so the spawner reads each role's frontmatter and converts it to the hard `--tools` gate.

## Install

From the repo root, run `install.sh` (forthcoming) — symlinks roles into `~/.pi/agent/skills/`, then `pi install <abs-path-to-pi-chains>`. Until then:

```bash
pi -e ./pi-chains/src/index.ts
```

…will load the extension for the current pi session.

## Status

Phase 2 scaffold complete: loader, role resolver, spawner, runner, and three commands wired. Default chains in `examples/` and end-to-end spike against pi-sandbox Challenge 1 are next (PLAN.md Phases 3–4).
