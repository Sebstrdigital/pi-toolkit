/**
 * pi-chains — sequential chain runner for pi role skills.
 *
 * Reads YAML chains from examples/, ~/.pi-chains/chains/, and <cwd>/.pi-chains/chains/,
 * then spawns each step's role via `pi --mode json -p ...` (see spawner.ts).
 *
 * Commands:
 *   /chain-list                       — list discovered chains
 *   /chain-run <name> "<prompt>"      — run a chain end-to-end
 *   /chain-resume <session-id>        — resume a crashed chain (TODO: pending session-id wiring)
 *
 * Variables in chain prompts: $ORIGINAL, $INPUT, $STEP[N].
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverChains } from "./chains-loader.ts";
import { runChain } from "./runner.ts";
import { listInstalledRoles } from "./role-resolver.ts";

const EXTENSION_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default function (pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		const chains = discoverChains(EXTENSION_DIR, ctx.cwd);
		if (chains.length === 0) return;
		const list = chains
			.map((c) => `  ${c.name} (${c.steps.map((s) => s.role).join(" → ")})`)
			.join("\n");
		ctx.ui.notify(`[Chains]\n${list}\n\nRun: /chain-run <name> <prompt>   List: /chain-list`, "info");
	});

	pi.registerCommand("chain-list", {
		description: "List available pi-chains",
		handler: async (_args, ctx) => {
			const chains = discoverChains(EXTENSION_DIR, ctx.cwd);
			if (chains.length === 0) {
				ctx.ui.notify(
					"No chains found. Drop YAML files into ~/.pi-chains/chains/ or <project>/.pi-chains/chains/, or ship them in the extension's examples/ dir.",
					"warning",
				);
				return;
			}
			const installedRoles = new Set(listInstalledRoles(ctx.cwd));
			const lines = chains.map((c) => {
				const flow = c.steps
					.map((s) => (installedRoles.has(s.role) ? s.role : `${s.role}(?)`))
					.join(" → ");
				const desc = c.description ? ` — ${c.description}` : "";
				return `• ${c.name}${desc}\n  ${flow}\n  source: ${c.source}`;
			});
			const missing = chains
				.flatMap((c) => c.steps.map((s) => s.role))
				.filter((r) => !installedRoles.has(r));
			const footer = missing.length
				? `\n\nUnresolved roles (marked '(?)'): ${[...new Set(missing)].join(", ")}\nRun pi-toolkit/install.sh to symlink pi-roles/* into ~/.pi/agent/skills/.`
				: "";
			ctx.ui.notify(lines.join("\n\n") + footer, "info");
		},
	});

	pi.registerCommand("chain-run", {
		description: "Run a chain: /chain-run <name> <prompt>",
		handler: async (args, ctx) => {
			const trimmed = (args ?? "").trim();
			if (!trimmed) {
				ctx.ui.notify("Usage: /chain-run <name> <prompt>", "warning");
				return;
			}
			const splitIdx = trimmed.indexOf(" ");
			const name = splitIdx === -1 ? trimmed : trimmed.slice(0, splitIdx);
			const prompt = splitIdx === -1 ? "" : trimmed.slice(splitIdx + 1);

			const chains = discoverChains(EXTENSION_DIR, ctx.cwd);
			const chain = chains.find((c) => c.name === name);
			if (!chain) {
				const available = chains.map((c) => c.name).join(", ") || "(none)";
				ctx.ui.notify(`Chain '${name}' not found. Available: ${available}`, "warning");
				return;
			}
			if (!prompt) {
				ctx.ui.notify(`Chain '${name}' selected. Provide a prompt: /chain-run ${name} <prompt>`, "warning");
				return;
			}

			const sessionDir = join(homedir(), ".pi-chains", "sessions", `${name}-${Date.now()}`);
			ctx.ui.notify(`Running chain '${name}' (${chain.steps.length} steps) — sessions: ${sessionDir}`, "info");

			const result = await runChain({
				chain,
				originalPrompt: prompt,
				cwd: ctx.cwd,
				sessionDir,
				onStepStart: (i, role) => ctx.ui.notify(`[${i + 1}/${chain.steps.length}] ${role} starting…`, "info"),
				onStepEnd: (i, r) => {
					const status = r.exitCode === 0 ? "done" : `FAILED (exit ${r.exitCode})`;
					ctx.ui.notify(`[${i + 1}/${chain.steps.length}] ${r.role} ${status} in ${Math.round(r.elapsedMs / 1000)}s`, r.exitCode === 0 ? "info" : "error");
				},
			});

			const summary = `Chain '${name}' ${result.success ? "complete" : "FAILED"} in ${Math.round(result.totalElapsedMs / 1000)}s.\nSessions: ${sessionDir}`;
			ctx.ui.notify(summary, result.success ? "info" : "error");
		},
	});

	pi.registerCommand("chain-resume", {
		description: "Resume a crashed chain run (not yet implemented)",
		handler: async (_args, ctx) => {
			ctx.ui.notify(
				"chain-resume is a stub for now. Resume support requires capturing the chain's session-id manifest at run start; tracked in PLAN.md Phase 2.",
				"warning",
			);
		},
	});
}
