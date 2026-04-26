/**
 * pi-ui — opinionated UX layer for pi-toolkit.
 *
 * Two responsibilities:
 *   1. Ship the Catppuccin Frappé theme via pi.themes (auto-discovered by pi).
 *   2. Replace pi's default multi-line footer with a one-line condensed status.
 *
 * Footer format:
 *   <cwd> (<branch>) │ <provider>/<model> │ <thinking> │ <tokens>/<window> (<pct>%) │ <FREE | $0.0123>
 *
 * Cost detection: pi's model config carries a `cost` field with per-million-token
 * rates for input/output/cacheRead/cacheWrite. Free-tier models (all zeros)
 * render as FREE; paid models accumulate `usage.cost.total` from each
 * assistant message in the session.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

function shortCwd(cwd: string): string {
	const home = homedir();
	return cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;
}

function gitBranch(cwd: string): string | null {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", { cwd, encoding: "utf8" }).trim() || null;
	} catch {
		return null;
	}
}

function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
	return `${n}`;
}

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		let cachedBranch = gitBranch(ctx.cwd);
		let cachedTokens: number | null = null;
		let cachedPct: number | null = null;
		let footerText: Text | null = null;

		const isFreeModel = (): boolean => {
			const c = (ctx.model as any)?.cost;
			if (!c) return false;
			return [c.input, c.output, c.cacheRead, c.cacheWrite].every((v) => !v || v === 0);
		};

		const sessionCost = (): number => {
			try {
				const entries = (ctx.sessionManager as any)?.getEntries?.() ?? [];
				let total = 0;
				for (const e of entries) {
					const cost = e?.message?.usage?.cost?.total ?? e?.usage?.cost?.total;
					if (typeof cost === "number") total += cost;
				}
				return total;
			} catch {
				return 0;
			}
		};

		const buildFooter = (): string => {
			const cwd = shortCwd(ctx.cwd);
			const branch = cachedBranch ? ` (${cachedBranch})` : "";
			const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "—";
			const thinking = pi.getThinkingLevel?.() || "off";
			const window = (ctx.model as any)?.contextWindow ?? 0;
			const tokenStr =
				cachedTokens !== null && window
					? `${fmtTokens(cachedTokens)}/${fmtTokens(window)} (${(cachedPct ?? 0).toFixed(0)}%)`
					: "—";
			const cost = isFreeModel() ? "FREE" : `$${sessionCost().toFixed(4)}`;
			const sep = " │ ";
			return `${cwd}${branch}${sep}${model}${sep}${thinking}${sep}${tokenStr}${sep}${cost}`;
		};

		ctx.ui.setFooter((_tui, theme) => {
			footerText = new Text("", 0, 0);
			return {
				render(width: number): string[] {
					footerText!.setText(theme.fg("muted", buildFooter()));
					return footerText!.render(width);
				},
				invalidate() {
					footerText?.invalidate();
				},
			};
		});

		const refreshUsage = async () => {
			try {
				const usage = await ctx.getContextUsage?.();
				if (usage) {
					if (typeof (usage as any).tokens === "number") cachedTokens = (usage as any).tokens;
					if (typeof (usage as any).percent === "number") cachedPct = (usage as any).percent;
					footerText?.invalidate();
				}
			} catch {
				/* best effort */
			}
		};

		pi.on("turn_end", async () => {
			cachedBranch = gitBranch(ctx.cwd);
			await refreshUsage();
		});
		pi.on("model_select", async () => footerText?.invalidate());
		await refreshUsage();
	});
}
