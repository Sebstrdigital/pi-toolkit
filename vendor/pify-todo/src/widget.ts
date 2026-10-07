import { counts, nextUp, type TodoItem } from "./todo.ts";

const WIDTH = 54;
export const MAX_SHOWN = 10;

export interface VisibleWindow {
  shown: TodoItem[];
  /** Items hidden above and below the window. */
  before: number;
  after: number;
}

/**
 * The slice of the list to render. Anchored on the item being worked next, so
 * a long list can't push the active item out of the widget — which is the one
 * thing the widget exists to show.
 */
export function visibleWindow(items: TodoItem[], max = MAX_SHOWN): VisibleWindow {
  if (items.length <= max) return { shown: items, before: 0, after: 0 };
  const active = nextUp(items);
  const focus = active ? items.indexOf(active) : 0;
  // Keep the active item roughly a third in, then clamp to the ends.
  const start = Math.max(0, Math.min(items.length - max, focus - Math.floor(max / 3)));
  return { shown: items.slice(start, start + max), before: start, after: items.length - start - max };
}

export interface ThemeLike {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

/** Compact checklist widget above the editor; empty list renders nothing. */
export function buildWidgetLines(items: TodoItem[], theme: ThemeLike): string[] {
  if (items.length === 0) return [];

  const dim = (s: string) => theme.fg("dim", s);
  const { completed, total } = counts(items);

  const lines: string[] = [];
  const title = ` ☰ todo ${completed}/${total} `;
  const hint = " /todos ";
  const pad = Math.max(1, WIDTH - title.length - hint.length);
  lines.push(dim(`╭${title}${"─".repeat(pad)}${hint}╮`));

  const { shown, before, after } = visibleWindow(items);
  if (before > 0) lines.push(dim(`│ … +${before} above`));
  for (const item of shown) {
    const content = item.content.length > 44 ? `${item.content.slice(0, 44)}…` : item.content;
    switch (item.status) {
      case "completed":
        lines.push(dim(`│ ✔ ${content}`));
        break;
      case "in_progress":
        lines.push(`${dim("│ ")}${theme.fg("warning", "▸ ")}${theme.bold(content)}`);
        break;
      default:
        lines.push(`${dim("│ ")}◻ ${content}`);
    }
  }
  if (after > 0) lines.push(dim(`│ … +${after} more`));

  lines.push(dim(`╰${"─".repeat(WIDTH)}╯`));
  return lines;
}
