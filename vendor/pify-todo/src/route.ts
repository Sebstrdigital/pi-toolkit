import { nextUp, summary, type TodoItem } from "./todo.ts";

/**
 * Routes for /todos. The list belongs to the agent, so the human-facing
 * commands stay read-only apart from `clear` — which exists because a stale
 * list nags the agent for the rest of the session with no other way out.
 */
export type TodoRoute =
  | { kind: "status" }
  | { kind: "next" }
  | { kind: "clear" }
  | { kind: "help" }
  | { kind: "unknown"; input: string };

export function parseTodoRoute(raw: string): TodoRoute {
  const text = (raw ?? "").trim().toLowerCase();
  if (!text) return { kind: "status" };
  switch (text) {
    case "status":
    case "list":
      return { kind: "status" };
    case "next":
      return { kind: "next" };
    case "clear":
      return { kind: "clear" };
    case "help":
    case "?":
      return { kind: "help" };
    default:
      return { kind: "unknown", input: text };
  }
}

export const TODO_USAGE = "Usage: /todos [status | next | clear]";

export interface RouteOutcome {
  text: string;
  level: "info" | "warning";
  /** The handler should empty the list and persist it. */
  clear: boolean;
}

export function routeText(route: TodoRoute, items: TodoItem[]): RouteOutcome {
  switch (route.kind) {
    case "status":
      return { text: summary(items), level: "info", clear: false };
    case "next": {
      const next = nextUp(items);
      return {
        text: next
          ? `Next up: ${next.content}${next.status === "in_progress" ? " (in progress)" : ""}`
          : items.length === 0
            ? "Todo list is empty."
            : "Nothing left — all items are done.",
        level: "info",
        clear: false,
      };
    }
    case "clear":
      return items.length === 0
        ? { text: "Todo list is already empty.", level: "info", clear: false }
        : { text: `Cleared ${items.length} item(s).`, level: "info", clear: true };
    case "help":
      return { text: TODO_USAGE, level: "info", clear: false };
    default:
      return { text: `Unknown route "${route.input}". ${TODO_USAGE}`, level: "warning", clear: false };
  }
}
