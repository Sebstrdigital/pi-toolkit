import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentDef } from "./agent-def.ts";

export interface AgentRuntime {
	def: AgentDef;
	sessionFile: string;
	turns: number;
	usage: AgentUsage;
}

export interface AgentUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

export interface SendOptions {
	cwd: string;
	prompt: string;
	onTextDelta?: (delta: string) => void;
	onThinkingDelta?: (delta: string) => void;
	onStderr?: (chunk: string) => void;
	onTurnComplete?: (text: string, usage: AgentUsage) => void;
	signal?: AbortSignal;
}

export interface SendResult {
	text: string;
	exitCode: number;
	stderr: string;
}

export function makeRuntime(def: AgentDef, runDir: string): AgentRuntime {
	const sessionsDir = join(runDir, "sessions");
	mkdirSync(sessionsDir, { recursive: true });
	return {
		def,
		sessionFile: join(sessionsDir, `${def.role}.json`),
		turns: 0,
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
	};
}

/**
 * One turn for one agent. Spawns `pi --mode json -p --session <file> [-c] <prompt>`.
 * On the first turn the system prompt is appended via a tempfile; pi then writes
 * it into the session file so subsequent `-c` resumes don't need it again.
 */
export function sendToAgent(runtime: AgentRuntime, opts: SendOptions): Promise<SendResult> {
	// Isolated context: no auto-loaded skills/extensions/CLAUDE.md/templates.
	// The agent only sees its system prompt (definition + roster) plus the
	// turn's user prompt.
	const args: string[] = [
		"--mode", "json",
		"-p",
		"--no-extensions",
		"--no-skills",
		"--no-context-files",
		"--no-prompt-templates",
		"--thinking", "off",
	];

	if (runtime.def.model) args.push("--model", runtime.def.model);
	if (runtime.def.tools.length > 0) args.push("--tools", runtime.def.tools.join(","));

	args.push("--session", runtime.sessionFile);

	let tmpDir: string | null = null;
	let tmpPromptFile: string | null = null;

	if (runtime.turns === 0 && runtime.def.systemPrompt.trim()) {
		tmpDir = mkdtempSync(join(tmpdir(), "pi-team-"));
		tmpPromptFile = join(tmpDir, `${runtime.def.role}.md`);
		writeFileSync(tmpPromptFile, runtime.def.systemPrompt, { encoding: "utf8", mode: 0o600 });
		args.push("--append-system-prompt", tmpPromptFile);
	} else {
		args.push("-c");
	}

	args.push(opts.prompt);

	return new Promise<SendResult>((resolveResult) => {
		const proc: ChildProcess = spawn("pi", args, {
			cwd: opts.cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env },
		});

		let buffer = "";
		const textChunks: string[] = [];
		let stderr = "";

		const cleanup = () => {
			if (tmpPromptFile) {
				try { unlinkSync(tmpPromptFile); } catch { /* ignore */ }
			}
		};

		const handleEvent = (event: any) => {
			if (event.type === "message_update") {
				const delta = event.assistantMessageEvent;
				if (delta?.type === "text_delta" && typeof delta.delta === "string") {
					textChunks.push(delta.delta);
					opts.onTextDelta?.(delta.delta);
				} else if (delta?.type === "thinking_delta" && typeof delta.delta === "string") {
					opts.onThinkingDelta?.(delta.delta);
				}
			} else if (event.type === "message_end" && event.message) {
				const msg = event.message;
				if (msg.role === "assistant" && msg.usage) {
					runtime.usage.input += msg.usage.input || 0;
					runtime.usage.output += msg.usage.output || 0;
					runtime.usage.cacheRead += msg.usage.cacheRead || 0;
					runtime.usage.cacheWrite += msg.usage.cacheWrite || 0;
					runtime.usage.cost += msg.usage.cost?.total || 0;
					runtime.usage.contextTokens = msg.usage.totalTokens || runtime.usage.contextTokens;
					runtime.usage.turns++;
				}
			}
		};

		proc.stdout!.setEncoding("utf8");
		proc.stdout!.on("data", (chunk: string) => {
			buffer += chunk;
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim()) continue;
				try { handleEvent(JSON.parse(line)); } catch { /* ignore non-JSON */ }
			}
		});

		proc.stderr!.setEncoding("utf8");
		proc.stderr!.on("data", (chunk: string) => {
			stderr += chunk;
			opts.onStderr?.(chunk);
		});

		proc.on("close", (code) => {
			if (buffer.trim()) {
				try { handleEvent(JSON.parse(buffer)); } catch { /* ignore */ }
			}
			cleanup();
			runtime.turns++;
			const text = textChunks.join("");
			opts.onTurnComplete?.(text, runtime.usage);
			resolveResult({ text, exitCode: code ?? 0, stderr });
		});

		proc.on("error", (err) => {
			cleanup();
			resolveResult({ text: "", exitCode: 1, stderr: stderr + `\nspawn error: ${err.message}` });
		});

		if (opts.signal) {
			const onAbort = () => {
				proc.kill("SIGTERM");
				setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
			};
			if (opts.signal.aborted) onAbort();
			else opts.signal.addEventListener("abort", onAbort, { once: true });
		}
	});
}
