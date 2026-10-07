import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// Pi retains the installed symlink path. Locate bundled modules from the real
// source entry, as in delivery-tmux, without loading a second controller.
const SOURCE = pathToFileURL(realpathSync(fileURLToPath(import.meta.url)));

// Keep the reviewed controller unchanged. Capture its registrations so the
// session-bound collision check runs before activating it, in every mode.
export default async function progress(pi: ExtensionAPI) {
  const { default: todo } = await import(fileURLToPath(new URL("../../vendor/pify-todo/extensions/todo.ts", SOURCE)));
  const handlers = new Map<string, Function[]>();
  let tool: any;
  let command: any;
  let ready = false;
  let conflict = "Progress controller has not passed session preflight";
  todo({
    ...pi,
    on(event: string, handler: Function) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return () => {};
    },
    registerTool(definition: any) { tool = definition; },
    registerCommand(_name: string, definition: any) { command = definition; },
  } as ExtensionAPI);

  pi.on("session_start", async (event, ctx) => {
    if (ready) {
      for (const h of handlers.get("session_start") ?? []) await h(event, ctx);
      return;
    }
    const otherTools = pi.getAllTools().filter(t => /^(todo|todo_write|todowrite|todo_list|update_todo)$/i.test(t.name));
    const otherCommands = pi.getCommands().filter(c => c.name === "todos");
    if (otherTools.length || otherCommands.length) {
      conflict = "Conflicting todo tool or /todos controller; disable duplicate progress resources and reload";
      if (ctx.hasUI) ctx.ui.notify(conflict, "error");
      throw new Error(conflict);
    }
    ready = true;
    // Register only after APIs are bound; forward the current startup exactly once.
    pi.registerTool({
      ...tool,
      description: "Replace the FULL working checklist. Keep at most one in_progress; zero is allowed when no work is active (for example blocked, paused, or finished). Team Plan is authority: only lead-accepted work is completed; active is in_progress; unresolved blocked/paused/cancelled/abandoned rows remain pending with explicit labels and reasons. Worker completion is not acceptance. Default scratch lists need no Plan. Maximum 30 rows; inspect warnings. No task suite required.",
      async execute(...args: any[]) {
        if (!ready) throw new Error(conflict);
        const items = args[1]?.items;
        if (Array.isArray(items) && items.filter(i => i?.status === "in_progress").length > 1) {
          throw new Error("Keep at most one active progress row; zero is allowed when no work is active; parallel lists are not supported");
        }
        return tool.execute(...args);
      },
    });
    pi.registerCommand("todos", {
      ...command,
      async handler(...args: any[]) {
        if (!ready) throw new Error(conflict);
        return command.handler(...args);
      },
    });
    for (const h of handlers.get("session_start") ?? []) await h(event, ctx);
  });
  for (const [event, callbacks] of handlers) {
    if (event === "session_start") continue;
    pi.on(event as any, async (ev: any, ctx: any) => {
      if (!ready) return;
      let result;
      for (const h of callbacks) result = await h(ev, ctx);
      return result;
    });
  }
}
