# @pify/todo

[![CI](https://github.com/pifydev/todo/actions/workflows/ci.yml/badge.svg)](https://github.com/pifydev/todo/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@pify/todo)](https://www.npmjs.com/package/@pify/todo) [![npm downloads](https://img.shields.io/npm/dm/@pify/todo)](https://www.npmjs.com/package/@pify/todo)

The agent's working-memory checklist for [pi](https://github.com/earendil-works/pi) — one tool, complete-replacement writes, a live widget, and next-item surfacing that keeps a long task from drifting.

Part of the [Pify suite](https://github.com/pifydev). Install with [`pify install todo`](https://github.com/pifydev/cli) or `pi install npm:@pify/todo`.

## Why

Multi-step work fails in a predictable way: the agent does step one well, notices something interesting in step two, and never comes back to steps three through six. A checklist it maintains itself is the cheapest fix — but only if writing to it is a single call and reading it costs nothing, which is why this is one tool and a widget rather than a system.

## The tool

### `todo_write`

| Parameter | Type | Notes |
|---|---|---|
| `items` | array | **The complete new list**, in display order |
| `items[].content` | string | Short imperative description |
| `items[].status` | `pending` \| `in_progress` \| `completed` | Free movement between all three |

Writes replace the whole list rather than patching it. There is no add, no update, no delete — one shape to get right, and no way for the agent's idea of the list to diverge from the stored one.

Invalid entries are dropped with a warning instead of failing the call. More than one `in_progress` warns but is allowed: work fanned out across parallel child agents genuinely has several things running at once.

The result is a one-liner — `2/5 done`, plus a `Completed: … Next up: …` line when something just finished. The full list is only echoed back when validation actually dropped or changed an entry (so the agent sees what survived); otherwise it would just duplicate the arguments the agent had already sent.

## Behaviour

- **Next-item surfacing.** Completing an item makes the tool answer `Completed: X. Next up: Y`, so attention lands on the right thing without re-reading the plan. This is the whole reason the list stops drift.
- **Live widget.** `☰ todo 2/5` with `✔` done (dim), `▸` in progress (bold), `◻` pending. Past ten items the visible window follows the active item rather than the top of the list — `… +4 above` / `… +2 more` — so what you are working on is always on screen.
- **Deliberately quiet.** No reminders, no steering, nothing the user sees. This list exists for the agent's benefit and never spends context arguing with it.
- **Branch-aware persistence.** Snapshot entries with last-wins replay: the widget survives `/reload`, compaction, and branch navigation, and switching session branches shows that branch's list rather than the last one written.
- **Recovery after compaction.** The list is stored as a state-only entry, which the model never sees again once compaction (or a summarized branch navigation) drops the original `todo_write`. So exactly once afterwards, the agent is handed its list back as a hidden message (`display: false` — invisible to the user) telling it to restore the list on its next write. This is the one message the extension ever injects, and only when memory was actually lost.

## Command

`/todos` — show the list.
`/todos status` — the same, explicitly.
`/todos next` — answer "what now?" with the current or next open item.
`/todos clear` — drop a stale list from the widget. Because writes are complete replacements, the agent may rebuild the list on its next `todo_write`; when it does, that write is told the clear was deliberate and skips re-announcing the old completions, so the reset is honoured rather than silently undone.

## todo vs task

| | `@pify/todo` | [`@pify/task`](https://github.com/pifydev/task) |
|---|---|---|
| Audience | The agent's own scratchpad | User-facing tracking |
| Structure | Flat list | Dependency graph (`blockedBy`/`blocks`) |
| Completion | Just mark it | Evidence required |
| Reminders | None — it stays quiet | Stale-list nudge and completion sweep |

They coexist: quick working memory here, verifiable project tracking there.

## License

MIT © [Pify maintainers](https://github.com/pifydev)
