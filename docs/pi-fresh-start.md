# Pi Fresh Start — One-Pager

*2026-10-06 · Draft for review*

## Why

Claude Max renews around 2026-10-13. The plan is to pause it, move to ChatGPT Pro ($100) and work in pi with GPT-6.1 Sol. Claude Code is a large harness that does a lot for us silently; pi is deliberately bare. The point of the switch is partly cost and partly craft: every capability in the new setup should be something we chose, understood, and can explain. So we start from zero and let things earn their way back in.

## Step 1 — Clean slate (decided)

Everything pi-related goes. The pi-toolkit repo is tagged `pre-reset-2026-10` so nothing is truly lost, then emptied. The global `pi-team-lean` link, `pi-mcp-adapter` and pi itself are uninstalled, `~/.pi` is deleted (sessions and logins included), and the latest pi is reinstalled with default settings. The eight role "skills" (scout, builder, architect and friends) go too — they were agent roles dressed as skills, not reusable skills. The old `defaultModel` (GPT-5.5) retires on 2026-10-14 anyway, and the settings still pointed at a `pi-team` package deleted back in May, so the old config was already rotting.

## Step 2 — What to bring over from Claude Code

Pi uses the same Agent Skills format (`SKILL.md` with frontmatter), so skills port by copying. Commands become pi prompt templates (`$ARGUMENTS` works the same). Hooks become pi extensions. Global rules move into `~/.pi/agent/AGENTS.md`; project `CLAUDE.md` files are already read by pi unchanged.

Usage over the last 30 days is lopsided: orchestrator (27), feature and sprint (16 each), workflow-authoring (11), debug (8), dataviz (7), claude-api (6), the PDF maker (5), grill-me (2). Everything else — all the audits, harness and UX skills, tdd, takt — was not invoked at all.

**Day one** should be small: a trimmed `AGENTS.md` of about 2 KB holding the rules that matter regardless of harness (human-in-the-loop, trace before claiming, search before removing, git hygiene, interrupts, HomeLab VM and teardown, terse output style) plus a line on using the munin CLI. Munin needs no MCP — its CLI already covers recall, remember, show and forget. Skills: `debug`, `grill-me`, `zoom-out` and `duadigital-pdf-maker`.

**Later, only when the absence hurts:** a tmux status extension, a git-guardrail extension, code-review and deep-review, the audit skills, feature/sprint/spec once there is a new sprint runner, client-proposal and the Swedish templates. MCP servers (context7, jcodemunch, obsidian) come back only if a CLI is not good enough.

**Drop:** everything that exists to manage Claude Code itself — context-mode, caveman plugin, token logging, statusline, takt's Claude workflow lib, the five Claude agent files, Workflow/Artifact-dependent skills, and the CLAUDE.md sections about effort escalation, jCodeMunch and context-mode.

## Step 3 — Jev as the decision layer

The research changed the picture. Pi 1.0.4 already ships Jev support: extensions call `ctx.modelRegistry.classify()` and pi handles auth, retries and usage. Pi even includes an example `jev-router.ts`. Dan's levels 6–10 (`jev-guard`, `jev-compact`, `ask-jev-files`, `ask-jev`) are pi extensions too. Our existing opencode key may already authorise `jev-1.13-free` — unverified, one free call settles it.

So Jev is not an agent and not a skill. It is a classifier that a pi extension calls in one of two ways. As a **tool** the main agent calls, it fits "which of these files matter before I read them" and failure triage. As an **event hook**, it fits gating bash/write calls and screening tool results — useful, but advisory, and we must decide whether a Jev error blocks or allows (pi blocks on a thrown error; Dan's code allows). The harness-neutral CLI from the earlier plan is no longer needed unless Claude Code must share the logic later.

**First experiment:** one read-only extension, `ask_jev_files` (~120 lines), that scores candidate files in parallel and skips on failure. Run 10–20 real tasks with and without it. It earns its place if Jev keeps at least 90% of the files the final fix actually touched, flags no more than a quarter of candidates, and cuts tokens before the first edit by 30% or more. Earlier measurements in Claude Code suggested 3–5% overall savings, so treat it as context hygiene first and cost saving second.

**Risks:** repo text goes to a third-party free tier with unverified terms; Jev's 32k context truncates large files; Dan's thresholds are hand-picked with no labelled eval; hook-driven Jev spend may not show in pi's cost footer.

## Before cancelling Claude

Move Hermes off the Claude CLI provider. Confirm OpenAI Pro login works in the fresh pi. Copy the day-one skills and write `AGENTS.md` while Claude is still available to help.
