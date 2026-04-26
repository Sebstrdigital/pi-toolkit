# pi-toolkit

Reusable primitives for working productively with [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) — badlogic's intentionally minimal coding agent. Pi ships bare (no plan mode, no subagents, no permissions, no MCP, no todos); this repo adds an opinionated layer on top without bloating pi itself.

## Packages

| Package | What it provides | Pi surface |
|---|---|---|
| [`pi-roles/`](pi-roles/) | Six markdown skill files defining narrow agent roles with hard tool restrictions (`scout`, `architect`, `builder`, `verifier`, `reviewer`, `debugger`). | Discovered as `/skill:<name>` after symlinking into `~/.pi/agent/skills/`. |
| [`pi-chains/`](pi-chains/) | TS extension that runs YAML-defined chains of role skills via `child_process.spawn("pi", ...)`. Pipes each step's output as `$INPUT` to the next. | `/chain-list`, `/chain-run <name> <prompt>`, `/chain-resume` (stub). |
| [`pi-ui/`](pi-ui/) | TS extension shipping the Catppuccin Frappé theme and a one-line condensed footer (cwd, branch, model, thinking, tokens, cost / FREE). | Auto-applied on session start. Independent of pi-chains. |

Workflow consumers (takt, ad-hoc audits, etc.) live in their own repos and reference these primitives.

## Install

```bash
git clone git@github.com:Sebstrdigital/pi-toolkit.git ~/work/git/pi-toolkit
cd ~/work/git/pi-toolkit
./install.sh
```

The installer:
1. Symlinks each `pi-roles/<role>/` into `~/.pi/agent/skills/<role>/` (idempotent).
2. Runs `npm install` + `pi install` for both `pi-chains` and `pi-ui`.
3. Sets `~/.pi/agent/settings.json#theme` to `catppuccin-frappe`.

Re-run any time after `git pull` to update.

## Default chains

Shipped in [`pi-chains/examples/`](pi-chains/examples/):

| Chain | Steps | Use |
|---|---|---|
| `plan-build-review` | scout → architect → builder → verifier → reviewer | Standard implementation flow |
| `scout-flow` | scout × 3 | Triple recon (broad map → focused dive → consolidation) — disler-style stand-in for pi's missing plan mode |
| `audit` | scout → reviewer | Read-only assessment, no edits |
| `debug-fix` | debugger → builder → verifier | Bug triage and fix |
| `refactor` | scout → architect → builder → verifier → reviewer | Iterative restructuring with no behavior change |

User chains override defaults; drop YAML into `~/.pi-chains/chains/` (global) or `<project>/.pi-chains/chains/` (project local).

### Chain YAML

```yaml
name: my-chain
description: ...
steps:
  - role: scout
    prompt: "$ORIGINAL"
  - role: builder
    timeout_sec: 240         # optional per-step wall-clock cap
    model: claude-sonnet-4-6 # optional per-step model pin
    provider: anthropic
    prompt: |
      $ORIGINAL

      Findings:
      $INPUT
```

Variables: `$ORIGINAL` (prompt passed to `/chain-run`), `$INPUT` (previous step's output), `$STEP[N]` (1-indexed earlier step output).

## Design notes

- **Tool enforcement.** Pi's `allowed-tools` skill frontmatter is experimental and lenient. The hard gate is `pi --tools <csv>` at spawn — pi-chains reads each role's `allowed-tools` and forwards it. Builder can't run `bash`, verifier can't `edit`, etc., enforced at the CLI.
- **Models.** No role pins a model by default. Each step inherits pi's currently active model unless the chain YAML overrides. Per-role pinning becomes opt-in once paid providers are configured.
- **Hangs.** Per-step `timeout_sec` (default 10 min) SIGKILLs the subprocess on overrun. The `verifier` step in implementation chains is capped tighter (240s) because `npm test` hangs were the dominant failure mode during the Phase 4 spike.

## Status

Phases 0–4 complete. Phase 4 spike: `plan-build-review` against pi-sandbox Challenge 1 with MiniMax m2.5 produced a correct repository-pattern refactor with 26/27 tests passing (the lone failure is a pre-existing buggy test in the suite). See [`PLAN.md`](PLAN.md) for the full implementation plan, decision history, and spike write-up.
