---
name: todo
description: Use for any work with 2+ distinct steps to keep a visible working checklist
---

# Working todo list

This project has the `@pify/todo` extension installed: `todo_write` maintains
your working-memory checklist, shown live in a widget.

## Discipline

1. Write the list BEFORE starting multi-step work — the user sees your plan.
2. Every call is a COMPLETE REPLACEMENT: always send the full list.
3. Keep exactly one item `in_progress` at a time.
4. Mark an item `completed` the moment it is done — the tool echoes what's
   next so you stay on track.
5. Drop items that stopped mattering by omitting them; send `[]` to clear
   when the work is finished.

## todo vs task

- `todo_write` (this) — your scratchpad: lightweight, no dependencies, no
  evidence. Default choice for organizing your own work.
- `task_create`/`task_update` (@pify/task, if installed) — user-facing
  tracking with dependency ordering and evidence-gated completion. Use when
  the user asks for tracked, verifiable progress.

Never mirror the same items into both.
