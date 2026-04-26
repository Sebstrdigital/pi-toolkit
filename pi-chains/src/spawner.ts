import { spawn } from "node:child_process";
import type { ChainStep, RoleDef, StepResult } from "./types.ts";

export interface SpawnOptions {
	step: ChainStep;
	role: RoleDef;
	prompt: string;
	sessionFile: string;
	resumeSession: boolean;
	cwd: string;
	/** Wall-clock cap for this step. SIGKILLs the pi subprocess on overrun. Default: 10 min. */
	timeoutMs?: number;
}

/**
 * Spawn pi for a single chain step. Mirrors disler's pattern from pi-vs-claude-code's
 * agent-chain.ts and the spawn pattern locked into PLAN.md after step 0.
 *
 *   pi --mode json -p \
 *      --no-extensions \
 *      [--model <provider/id>]   # omitted when not pinned -> inherits pi's active model
 *      --tools <csv from skill>  \
 *      --thinking off \
 *      --skill <abs path to SKILL.md> \
 *      --session <session-file> \
 *      [-c]                      # when resuming
 *      "<rendered prompt>"
 */
export function spawnStep(opts: SpawnOptions): Promise<StepResult> {
	const args = [
		"--mode", "json",
		"-p",
		"--no-extensions",
		"--thinking", "off",
		"--skill", opts.role.skillPath,
		"--session", opts.sessionFile,
	];

	if (opts.role.allowedTools) {
		args.push("--tools", opts.role.allowedTools);
	}

	const model = resolveModel(opts.step);
	if (model) {
		args.push("--model", model);
	}

	if (opts.resumeSession) {
		args.push("-c");
	}

	args.push(opts.prompt);

	const start = Date.now();
	const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
	return new Promise((resolve) => {
		const proc = spawn("pi", args, {
			cwd: opts.cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env },
		});

		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGKILL");
		}, timeoutMs);

		const textChunks: string[] = [];
		let buffer = "";

		proc.stdout!.setEncoding("utf8");
		proc.stdout!.on("data", (chunk: string) => {
			buffer += chunk;
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line);
					if (event.type === "message_update") {
						const delta = event.assistantMessageEvent;
						if (delta?.type === "text_delta" && typeof delta.delta === "string") {
							textChunks.push(delta.delta);
						}
					}
				} catch {
					// Non-JSON line — pi may have logged something pre-stream. Ignore.
				}
			}
		});

		proc.stderr!.setEncoding("utf8");
		proc.stderr!.on("data", () => {
			// stderr captured but not surfaced in StepResult yet — runner can layer on later.
		});

		proc.on("close", (code) => {
			clearTimeout(timer);
			const suffix = timedOut
				? `\n\n[pi-chains] step exceeded ${Math.round(timeoutMs / 1000)}s timeout — SIGKILL'd. Likely cause: a tool call (e.g. \`npm test\`) hung inside the spawned pi run.`
				: "";
			resolve({
				role: opts.role.name,
				output: textChunks.join("") + suffix,
				exitCode: timedOut ? 124 : code ?? 1,
				elapsedMs: Date.now() - start,
			});
		});

		proc.on("error", (err) => {
			clearTimeout(timer);
			resolve({
				role: opts.role.name,
				output: `Error spawning pi: ${err.message}`,
				exitCode: 1,
				elapsedMs: Date.now() - start,
			});
		});
	});
}

function resolveModel(step: ChainStep): string | undefined {
	if (step.model && step.provider) return `${step.provider}/${step.model}`;
	if (step.model) return step.model;
	return undefined;
}
