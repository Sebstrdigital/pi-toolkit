# Pi Fresh Start

*2026-10-06 · Current status*

## Direction

Move from Claude Code to a deliberately minimal pi setup with GPT-6.1 Sol.
The switch is partly about cost and partly about craft: every capability
should be something we chose, understand, and can explain. Let additions
earn their place through real work rather than restoring the old harness.

The original plan was to pause Claude Max before its renewal around
2026-10-13 and use ChatGPT Pro. Billing, subscription tier, and cancellation
status have not been verified in this repository.

## Done: clean slate and day-one setup

The old toolkit is preserved under `pre-reset-2026-10`. The reset was
committed as `7816915`, followed by the minimal setup and history
reconciliation. No old team harness was restored.

The installed setup now includes:

- A symlinked global `agent/AGENTS.md`, 578 bytes, covering approval,
  evidence, destructive/outward actions, project rules, Munin, and writing.
- Empty overrides shielding the three relevant directories from
  Claude-specific context without changing their `CLAUDE.md` files.
- On-demand skills: debug, grill-me, zoom-out (explicit-only),
  duadigital-pdf-maker, homelab-validation, and delivery.
- An idempotent, conflict-safe symlink installer.
- OpenAI / `gpt-6.1-sol` selected in the global pi settings.
- `npm:pi-web-access` configured as a package.

Munin is accessed through its CLI; no memory MCP is needed. PDF rendering
and HomeLab access were not revalidated during this reconciliation.

## Added after real use: delivery and progress

The first real delivery run in Dikta exposed a roughly 25-minute builder
run with no visible progress. That concrete need justified a small
sequential delivery mechanism:

1. The main session investigates and obtains approval for a contract.
2. A fresh builder implements the approved task.
3. The coordinator checks actual changes and validation evidence.
4. A fresh inspection-only reviewer independently reviews the change.
5. Bounded fix cycles and final acceptance precede the handoff.

The toolkit supplies role prompts, a one-shot launcher, and a coordinator
extension showing elapsed time, observed activity, token/cache usage, and
terminal state. It does not invent completion percentages or infer hangs
from silence. Workers remain sequential; there is no recursive delegation
or automatic concurrent implementation.

The progress feature was accepted after independent review. Recorded final
validation passed 40 tests. On 2026-10-06 the user confirmed that the widget
is okay for now; no further widget work is planned. This feedback is not a
claim that every interactive cancellation or terminal scenario was tested.

See [delivery-workflow.md](delivery-workflow.md) and the README for current
contracts, tools, validation, and enforcement limits. Builder access is
not sandboxed, reviewer paths are not confined, and detached descendants
may survive cancellation.

Planning/startup approval friction was also reported. Collect more real-use
feedback before changing the approval policy; no relaxation is approved.

## Expansion policy

Before building new infrastructure, inspect the community package catalog:
https://pi.dev/packages.

In particular, a future subagent expansion of delivery may use a community
subagent extension rather than a custom implementation. This is a
candidate direction, not a selected dependency. Evaluate current packages
against our approval contract, independent review, evidence, cancellation,
isolation, and integration ownership before adopting one. Concurrent
writers and nested delegation still require an explicitly approved design.

MCP servers, audit/review skills, sprint runners, and other extensions come
back only when a real task demonstrates the need. Drop Claude-only harness
management rather than porting it mechanically.

## Deferred: Jev

No `ask_jev_files` extension has been implemented in this toolkit. Jev is
on hold by user decision; no auth probe or repository submission is planned
now.

The original research identified pi's classifier interface and proposed a
read-only file-relevance experiment, skipping on failure. If resumed, first
verify the current API, provider authorization, and third-party data terms.
Then compare 10–20 real tasks with and without it. Original acceptance
thresholds were:

| Measure | Threshold |
| --- | --- |
| Files the final fix touched that Jev kept | ≥ 90% |
| Candidate files flagged relevant | ≤ 25% |
| Tokens spent before the first edit | −30% or better |

Treat this as context hygiene first, cost saving second. Context limits,
unvalidated thresholds, and cost visibility remain risks to investigate.

## Deferred: Hermes and subscription checks

Hermes migration off the Claude CLI provider can wait by user decision.
Its current provider has not been checked. Before actually cancelling
Claude, revisit that dependency and verify the intended OpenAI login and
subscription. Deferral is not evidence that cancellation is safe.

## Session close

The user authorized documentation reconciliation and a selective commit
of the current toolkit. Raw worker transcripts, probe artifacts, local
caches, and the Claude-only context file are excluded from that commit.
No push or publishing is authorized. Further Jev, Hermes, and widget work
is deferred.
