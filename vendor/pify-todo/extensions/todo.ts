/**
 * @pify/todo — the agent's working-memory checklist.
 *
 * Claude Code TodoWrite-style: one tool, complete-replacement writes, a live
 * widget, and next-item surfacing (completing an item echoes what's next —
 * avtc's idea) to keep the agent on track. Deliberately lightweight: no
 * dependencies between items, no evidence gates, no reminders — that heavier
 * discipline is @pify/task's job; this is the scratchpad.
 *
 * State persists as snapshot entries (last-wins replay), so the list is
 * branch-aware and survives /reload and compaction for free.
 *
 * Design synthesis: complete-replacement semantics (tintinweb/
 * pi-manage-todo-list, CC TodoWrite), next-item surfacing (avtc-pi-todo),
 * branch-aware snapshots (diegopetrucci/todo, pi's own example).
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import {
  TODO_STATE,
  counts,
  newlyCompleted,
  nextUp,
  replayBranch,
  summary,
  validateItems,
  type TodoItem,
} from "../src/todo.ts";
import { parseTodoRoute, routeText } from "../src/route.ts";
import { buildWidgetLines } from "../src/widget.ts";

type UiContext = ExtensionContext;

export default function todo(pi: ExtensionAPI) {
  let items: TodoItem[] = [];
  // The list is persisted only as a state-only custom entry, which pi never
  // puts back into LLM context. After a compaction (or a summarized branch
  // navigation) the widget survives but the agent's own memory of the list is
  // gone, so flag a one-time re-injection on the next turn (f113).
  let reinject = false;
  // Set when the user runs `/todos clear` so the next complete-replacement
  // write doesn't mis-announce old completions as new (f115).
  let clearedByUser = false;

  function renderWidget(ctx: UiContext): void {
    if (!ctx.hasUI) return;
    if (items.length === 0) {
      ctx.ui.setWidget("todo", undefined);
      return;
    }
    ctx.ui.setWidget(
      "todo",
      (_tui: unknown, theme: { fg(c: string, s: string): string; bold(s: string): string }) =>
        new Text(buildWidgetLines(items, theme).join("\n"), 0, 0),
      { placement: "aboveEditor" },
    );
  }

  pi.registerTool({
    name: "todo_write",
    label: "Todo list",
    promptSnippet: "Keep a short checklist for the work in hand",
    description:
      "Replace the working todo list (complete replacement — send the FULL list every time). " +
      "Use for multi-step work: create items before starting, keep exactly one in_progress, mark " +
      "items completed the moment they are done, and remove items that stopped mattering by " +
      "omitting them. An empty array clears the list. This is your scratchpad — for user-facing " +
      "tracking with dependencies and evidence, use the task tools instead (if installed).",
    parameters: Type.Object({
      items: Type.Array(
        Type.Object({
          content: Type.String({ description: "Short imperative description" }),
          status: StringEnum(["pending", "in_progress", "completed"] as const),
        }),
        { description: "The complete new list, in display order" },
      ),
    }),
    async execute(_id, params: { items: unknown }, _signal, _onUpdate, ctx) {
      const previous = items;
      const result = validateItems(params.items);
      items = result.items;
      pi.appendEntry(TODO_STATE, { items });
      renderWidget(ctx as UiContext);

      // f116: the model just sent the whole list as arguments, so echoing it
      // back verbatim every call is pure duplication. Lead with a one-line
      // count and only spell out the surviving list when validation dropped or
      // altered entries — the one case where what we stored differs from what
      // the model sent.
      const { completed, total } = counts(items);
      const parts: string[] =
        result.warnings.length > 0
          ? [summary(items)]
          : [items.length === 0 ? "Todo list is empty." : `${completed}/${total} done`];

      if (clearedByUser) {
        // f115: the user wiped the list with /todos clear between writes. This
        // complete-replacement write resurrects it, and with `previous` now
        // empty newlyCompleted would report every done item as freshly
        // completed — so skip that echo and tell the model the clear was
        // deliberate.
        clearedByUser = false;
        parts.push(
          "Note: the user cleared the previous list with /todos clear — only keep items that still matter.",
        );
      } else {
        const done = newlyCompleted(previous, items);
        if (done.length > 0) {
          const next = nextUp(items);
          parts.push(
            next
              ? `Completed: ${done.join(", ")}. Next up: ${next.content}`
              : `Completed: ${done.join(", ")}. All items done.`,
          );
        }
      }
      if (result.warnings.length > 0) parts.push(`Warnings: ${result.warnings.join("; ")}`);

      return {
        content: [{ type: "text", text: parts.join("\n\n") }],
        details: { count: items.length, warnings: result.warnings },
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    items = replayBranch(ctx.sessionManager.getBranch() as never);
    renderWidget(ctx);
  });

  pi.on("session_tree", async (event, ctx) => {
    items = replayBranch(ctx.sessionManager.getBranch() as never);
    renderWidget(ctx);
    // A branch navigation that summarized the old leaf drops the same working
    // memory a compaction does, so re-show the list on the next turn (f113).
    if (event.summaryEntry && items.length > 0) reinject = true;
  });

  // Compaction replaces the todo_write tool call/result the model was reading
  // from with a summary that may not reproduce the list verbatim. The state
  // entry keeps the widget alive but never re-enters context, so flag a
  // one-time re-injection (f113).
  pi.on("session_compact", async () => {
    reinject = items.length > 0;
  });

  // Once, after a compaction or summarized branch, hand the agent its list back
  // as a hidden message so it can restore it on the next todo_write. display:
  // false keeps the "deliberately quiet" promise — the user sees nothing.
  pi.on("before_agent_start", async () => {
    if (!reinject) return;
    reinject = false;
    if (items.length === 0) return;
    return {
      message: {
        customType: "todo-restore",
        content:
          "Your working todo list (restore it with todo_write when you next update it):\n" +
          summary(items),
        display: false,
      },
    };
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setWidget("todo", undefined);
  });

  pi.registerCommand("todos", {
    description: "The agent's working todo list: /todos [status | next | clear]",
    handler: async (args, ctx) => {
      const outcome = routeText(parseTodoRoute(args ?? ""), items);
      if (outcome.clear) {
        items = [];
        clearedByUser = true;
        pi.appendEntry(TODO_STATE, { items });
        renderWidget(ctx as UiContext);
      }
      if (ctx.hasUI) ctx.ui.notify(outcome.text, outcome.level);
    },
  });
}
