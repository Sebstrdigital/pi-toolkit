/**
 * Local types + pure logic for @pify/todo.
 * No imports from pi packages: src/ typechecks and runs standalone.
 */

export const TODO_STATUSES = ["pending", "in_progress", "completed"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export interface TodoItem {
  content: string;
  status: TodoStatus;
}

export const TODO_STATE = "todo-state";
export const MAX_ITEMS = 30;

export interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface ValidationResult {
  items: TodoItem[];
  warnings: string[];
}

/**
 * Validate a complete-replacement write (Claude Code TodoWrite semantics):
 * the submitted array becomes the entire list. Invalid entries are dropped
 * with warnings; more than one in_progress warns but is allowed (parallel
 * subagent work — tintinweb's concession).
 */
export function validateItems(raw: unknown): ValidationResult {
  const warnings: string[] = [];
  if (!Array.isArray(raw)) return { items: [], warnings: ["items must be an array"] };

  const items: TodoItem[] = [];
  for (const entry of raw.slice(0, MAX_ITEMS)) {
    if (!isRecord(entry) || typeof entry.content !== "string" || !entry.content.trim()) {
      warnings.push("dropped an item without content");
      continue;
    }
    const status = (TODO_STATUSES as readonly string[]).includes(entry.status as string)
      ? (entry.status as TodoStatus)
      : "pending";
    if (status !== entry.status && entry.status !== undefined) {
      warnings.push(`item "${entry.content.toString().slice(0, 30)}": invalid status, defaulted to pending`);
    }
    items.push({ content: entry.content.trim(), status });
  }
  if (Array.isArray(raw) && raw.length > MAX_ITEMS) {
    warnings.push(`list capped at ${MAX_ITEMS} items`);
  }

  const inProgress = items.filter((i) => i.status === "in_progress").length;
  if (inProgress > 1) {
    warnings.push(`${inProgress} items in_progress — prefer exactly one unless work is truly parallel`);
  }
  return { items, warnings };
}

/** Contents newly completed relative to the previous list. */
export function newlyCompleted(prev: TodoItem[], next: TodoItem[]): string[] {
  const wasCompleted = new Set(prev.filter((i) => i.status === "completed").map((i) => i.content));
  return next
    .filter((i) => i.status === "completed" && !wasCompleted.has(i.content))
    .map((i) => i.content);
}

/**
 * The item the agent should look at next (avtc's next-item surfacing):
 * the first in_progress, else the first pending.
 */
export function nextUp(items: TodoItem[]): TodoItem | null {
  return items.find((i) => i.status === "in_progress") ?? items.find((i) => i.status === "pending") ?? null;
}

export function counts(items: TodoItem[]): { completed: number; total: number } {
  return { completed: items.filter((i) => i.status === "completed").length, total: items.length };
}

/** Text summary for the tool result and /todos. */
export function summary(items: TodoItem[]): string {
  if (items.length === 0) return "Todo list is empty.";
  const { completed, total } = counts(items);
  const lines = items.map((i) => {
    const mark = i.status === "completed" ? "✔" : i.status === "in_progress" ? "▸" : "◻";
    return `${mark} ${i.content}`;
  });
  return [`${completed}/${total} done`, ...lines].join("\n");
}

/** Snapshot replay: last todo-state entry on the branch wins. */
export function replayBranch(entries: BranchEntryLike[]): TodoItem[] {
  let items: TodoItem[] = [];
  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== TODO_STATE) continue;
    const data = entry.data;
    if (isRecord(data) && Array.isArray(data.items)) {
      items = validateItems(data.items).items;
    }
  }
  return items;
}
