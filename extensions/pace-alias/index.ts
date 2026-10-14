import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Pi expands skills after extensions receive raw input.  A prompt-template alias
 * would therefore leave `/skill:...` as ordinary prompt text; transform the raw
 * command into Pi's canonical skill command instead.
 */
export function expandPaceInput(text: string): string | undefined {
  const match = /^\/pace(?:\s+([\s\S]*))?\s*$/i.exec(text);
  if (!match) return undefined;
  const task = match[1]?.trim();
  return `/skill:addy-engineering PACE.${task ? ` ${task}` : " Continue at the next unfinished phase of the understood task."}`;
}

export function validatePaceCommands(commands: readonly { name: string }[]): "ok" | "collision" | "missing-skill" {
  if (commands.some(command => command.name.toLowerCase() === "pace")) return "collision";
  return commands.some(command => command.name === "skill:addy-engineering") ? "ok" : "missing-skill";
}

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };
    const text = expandPaceInput(event.text);
    if (!text) return { action: "continue" };
    const state = validatePaceCommands(pi.getCommands());
    if (state === "collision") {
      ctx.ui.notify("/pace is already provided by another command; the alias did not override it.", "warning");
      return { action: "continue" };
    }
    if (state === "missing-skill") {
      const error = "/pace requires the installed addy-engineering skill; no prompt was sent.";
      if (ctx.hasUI) ctx.ui.notify(error, "error"); else console.error(error);
      return { action: "handled" };
    }
    return { action: "transform", text };
  });
}
