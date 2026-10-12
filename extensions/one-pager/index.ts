import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { Container, Text, SelectList, matchesKey, Key } from "@earendil-works/pi-tui";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE = pathToFileURL(realpathSync(fileURLToPath(import.meta.url)));
const Mode = Type.Union([Type.Literal("briefing"), Type.Literal("guide"), Type.Literal("explainer"), Type.Literal("decision-review")]);
const Modes = Type.Array(Mode, { minItems: 1, maxItems: 4, uniqueItems: true });

export default async function onePager(pi: ExtensionAPI) {
  const { MODES, validateModes, modeOptions } = await import(new URL("../../skills/one-pager/scripts/modes.mjs", SOURCE).href);
  let busy = false;

  // Each custom component belongs to one question. No session-wide defaults:
  // yesterday's selection must not replace today's explicit user answer.
  async function picker(ctx: ExtensionContext, recommended: string[], reason: string, combine: boolean, signal?: AbortSignal): Promise<string[] | string | null> {
    return ctx.ui.custom<string[] | string | null>((tui, theme, _kb, done) => {
      const selected = new Set<string>(); // Recommendations are hints, not preselected answers.
      const container = new Container();
      let list: SelectList;
      let closed = false;
      const finish = (answer: string[] | string | null) => {
        if (closed) return;
        closed = true;
        signal?.removeEventListener("abort", abort);
        done(answer);
      };
      const abort = () => finish(null);
      function rebuild(index = 0) {
        container.clear();
        container.addChild(new DynamicBorder(s => theme.fg("accent", s)));
        container.addChild(new Text(theme.bold(combine ? "Combine one-pager modes" : "What kind of one-pager would you like?"), 1, 0));
        container.addChild(new Text(`Recommendation: ${recommended.map(id => MODES.find((m: any) => m.id === id).label).join(' + ')}. ${reason}`, 1, 0));
        const items = combine
          ? [...MODES.map((m: any) => ({ value: m.id, label: `[${selected.has(m.id) ? 'x' : ' '}] ${m.label}${recommended.includes(m.id) ? ' (recommended)' : ''}`, description: m.description })),
              { value: "continue", label: "Use selected modes", description: "Select at least two; Enter here to continue." }]
          : modeOptions(recommended);
        list = new SelectList(items, 5, {
          selectedPrefix: s => theme.fg("accent", s), selectedText: s => theme.fg("accent", s),
          description: s => theme.fg("muted", s), scrollInfo: s => theme.fg("dim", s), noMatch: s => theme.fg("warning", s),
        });
        list.setSelectedIndex(index);
        list.onSelect = item => {
          if (!combine) { finish(item.value); return; }
          if (item.value === "continue") {
            if (selected.size >= 2) finish(MODES.filter((m: any) => selected.has(m.id)).map((m: any) => m.id));
            return;
          }
          selected.has(item.value) ? selected.delete(item.value) : selected.add(item.value);
          rebuild(MODES.findIndex((m: any) => m.id === item.value));
        };
        list.onCancel = () => finish(null);
        container.addChild(list);
        container.addChild(new Text(combine ? "↑↓ navigate · Space/Enter toggle · select ‘Use selected modes’ to finish · Esc cancel" : "↑↓ navigate · Enter select · Esc cancel", 1, 0));
        container.addChild(new DynamicBorder(s => theme.fg("accent", s)));
      }
      rebuild();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) finish(null);
      return {
        render: width => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput(data) {
          if (closed) return;
          if (combine && matchesKey(data, Key.space)) {
            const item = list.getSelectedItem();
            if (item && item.value !== "continue") list.onSelect?.(item);
          } else list.handleInput(data);
          tui.requestRender();
        },
        dispose: () => { signal?.removeEventListener("abort", abort); },
      };
    });
  }

  pi.registerTool({
    name: "one_pager_mode",
    label: "Choose one-pager type",
    exposure: "model-only",
    description: "Ask which one-pager presentation the user wants using a native five-option widget: Briefing, Guide, Explainer, Decision review, Combine modes. Supply recommended modes and a short reason based on the current conversation. Combine opens a multi-select. If the user already specified modes, skip this tool. Selection is presentation preference only, never approval of content or implementation. Cancel means stop, not choose the recommendation.",
    parameters: Type.Object({ recommended: Modes, reason: Type.String({ minLength: 1, maxLength: 300 }) }),
    async execute(_id, params, signal, _update, ctx) {
      const recommended = validateModes(params.recommended);
      const reason = params.reason.replace(/[\x00-\x1f\x7f-\x9f]/g, " ").trim();
      if (!reason) throw new Error("Supply a short context-based recommendation reason");
      const options = modeOptions(recommended);
      const result = (status: string, modes: string[] = []) => ({
        content: [{ type: "text" as const, text: JSON.stringify({ status, modes, recommended, options, ...(status === "ui-unavailable" ? { instruction: "Ask the user in text or obtain explicit modes; do not silently choose the recommendation." } : {}) }) }],
        details: { status, modes, recommended },
      });
      if (signal?.aborted) return result("cancelled");
      if (!ctx.hasUI) return result("ui-unavailable");
      if (busy) throw new Error("A one-pager mode question is already open");
      busy = true;
      try {
        let choice: string | null | undefined;
        if (ctx.mode === "tui") choice = await picker(ctx, recommended, reason, false, signal) as string | null;
        else {
          const labels = options.map((o: any) => `${o.label} — ${o.description}`);
          const answer = await ctx.ui.select(`One-pager type: ${reason}`, labels, { signal });
          choice = options[labels.indexOf(answer ?? "")]?.value;
        }
        if (!choice || signal?.aborted) return result("cancelled");
        if (choice !== "combine") return result("selected", validateModes([choice]));
        let modes: string[] | null = null;
        if (ctx.mode === "tui") modes = await picker(ctx, recommended, reason, true, signal) as string[] | null;
        else {
          // RPC forwards built-in dialogs, not terminal custom components.
          const selected = new Set<string>();
          while (!signal?.aborted) {
            const labels = MODES.map((m: any) => `[${selected.has(m.id) ? 'x' : ' '}] ${m.label}${recommended.includes(m.id) ? ' (recommended)' : ''} — ${m.description}`);
            labels.push("Use selected modes (at least two)");
            const answer = await ctx.ui.select("Combine modes: toggle choices, then use selected modes", labels, { signal });
            if (!answer) break;
            const index = labels.indexOf(answer);
            if (index === MODES.length) {
              if (selected.size >= 2) { modes = MODES.filter((m: any) => selected.has(m.id)).map((m: any) => m.id); break; }
            } else if (index >= 0) {
              const id = MODES[index].id;
              selected.has(id) ? selected.delete(id) : selected.add(id);
            } else break;
          }
        }
        return modes && !signal?.aborted ? result("selected", validateModes(modes, 2)) : result("cancelled");
      } finally { busy = false; }
    },
  });
}
