# Handover: pi day-one setup

> Historical setup packet, retained for context. Day-one setup is complete.
> Do not replay these instructions. See `pi-fresh-start.md` in this directory
> for current status and deferred work.

Paste everything below the line into pi. Start pi from `~/work/git/pi-toolkit` with `pi -nc` (`--no-context-files`). Otherwise pi loads the parent `CLAUDE.md` files (about 14 KB of Claude Code–only rules) into this session.

---

You are helping Sebastian set up a deliberately minimal pi environment. He is moving from Claude Code to pi (GPT-6.1 Sol, thinking medium, ChatGPT Pro login). Everything pi-related was wiped on 2026-10-06: `~/.pi` is fresh, and the pi-toolkit repo was emptied. The old toolkit lives under the git tag `pre-reset-2026-10`; do not restore any of it unless asked. Read `docs/pi-fresh-start.md` in this repo for the full plan.

## How to work with Sebastian

- He drives, you navigate. Research, propose, and wait for his decision. Never write, delete, or overwrite files without showing him the content or the exact command first and getting a yes.
- Back every claim with evidence (a file path, command output, or doc line). If you have not checked, say so.
- Keep replies short and direct.
- Keep everything small. The point of this setup is a lean system prompt. If something can be a skill (loaded on demand) instead of always-on text, make it a skill.

## Facts already verified (pi 1.0.4 installed docs)

- Context files: pi loads `AGENTS.md`/`CLAUDE.md` from `~/.pi/agent/`, the working directory, and every parent directory (`docs/configuration.md:43`). An `AGENTS.override.md` replaces `AGENTS.md`/`CLAUDE.md` in the same directory only.
- Skills: only name, description, and path enter the system prompt; full text loads on demand (`docs/skills.md:43`). Locations: `~/.pi/agent/skills/` (global), `.pi/skills/` (project).
- Per-agent prompts: `--system-prompt <file>`, `--append-system-prompt <file>` (repeatable), `--no-context-files` (`docs/cli.md:214-232`).
- munin (semantic project memory) has a CLI: `munin recall "<query>" -p <project> --json`, `munin remember`, `munin show`, `munin forget`, `munin projects`. No MCP needed.

## Day-one tasks, in order

Do one task at a time. Show the draft, wait for approval, then apply.

1. **Stop parent `CLAUDE.md` bloat.** These files exist for Claude Code, which still runs until about 2026-10-13, so do not edit or delete them:
   - `~/work/CLAUDE.md` (6.4 KB)
   - `~/work/git/CLAUDE.md` (3.7 KB)
   - `~/work/git/pi-toolkit/CLAUDE.md` (3.7 KB, untracked, context-mode rules)

   Propose an empty `AGENTS.override.md` next to each. Then verify that a normal `pi` session started in `~/work/git/pi-toolkit` no longer sees them; find a way to inspect the effective system prompt or context files. If an empty override file does not work, report that and propose an alternative. Ask Sebastian whether `pi-toolkit/CLAUDE.md` should be deleted instead, since it is untracked.

2. **Global `AGENTS.md`, about 8 lines, under 600 bytes.** Keep the source in this repo at `agent/AGENTS.md` and symlink it to `~/.pi/agent/AGENTS.md`. Content must cover only these points:
   - Human in the loop: propose, wait for approval; no changes without explicit instruction.
   - Trace before claiming; no guessing.
   - Ask before destructive or outward-facing actions (delete, force, push, publish).
   - Project rules live in the repo's own `AGENTS.md`.
   - For past decisions and context, run `munin recall "<query>" -p <project>`, where project is the git root's folder name.
   - Terse replies; full prose for code, commit messages, and documents meant for others.

   Draft it, show the byte count, and wait for approval.

3. **Port four skills from `~/.claude/skills/`:** `debug`, `grill-me`, `zoom-out`, `duadigital-pdf-maker`.
   - Store them in this repo under `skills/<name>/` and symlink each into `~/.pi/agent/skills/<name>`.
   - Read each `SKILL.md` first. Remove or adapt anything that references Claude Code–only tools (Agent/Task, Workflow, Artifact, AskUserQuestion, `mcp__*`, jCodeMunch, `ctx_*`, CLAUDE.md conventions).
   - Check `duadigital-pdf-maker`'s runtime dependencies and report them.
   - Show a short diff summary per skill before writing.

4. **New skill `homelab-validation`.** Convert the "HomeLab Validation Environment" and "Teardown when idle" sections of `~/.claude/CLAUDE.md` into a skill. The description should trigger on: needing a container, staging stack, database, build, or browser/API test environment. The body must keep:
   - Host `validation.local`, `ssh validation`, project root `/srv/validation/projects/<slug>`.
   - The probe command.
   - Teardown rules: a stack runs only while in use; take it down when idle.
   - Always-on exceptions: `homelab-registry`, Caddy, `gitlab-runner`.
   - Never auto-start the old MacBook Podman machine.

5. **Update `README.md`** to list what now exists (`agent/AGENTS.md`, `skills/`) and a small `install.sh` that only creates the symlinks, idempotently. Show it first.

6. **Commit** after Sebastian approves, using a conventional commit message. Do not push without asking.

## Not today

- Jev / `ask_jev_files` experiment (see `docs/pi-fresh-start.md`, step 3).
- MCP servers, extensions, role prompts, sprint runners. Add only when a real task shows the need.

## When done

Save a short summary of what was set up to munin:

```
munin remember "<summary>" -p pi-toolkit
```

Check `munin remember --help` for the exact flags first.
