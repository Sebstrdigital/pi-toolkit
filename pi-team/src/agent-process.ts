import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentDef } from "./agent-def.ts";

/**
 * Per-agent persistent process backed by `pi --mode rpc`.
 *
 * Phase 8 change: instead of spawning a fresh `pi -p` per turn (which
 * forces pi to re-read the session JSON file from disk and the LLM to
 * re-process the entire conversation as input every call), we keep one
 * long-lived `pi --mode rpc` subprocess per agent for the harness run.
 * Each `sendToAgent` writes a `{"type":"prompt", …}` line to its stdin
 * and consumes events until `agent_end`.
 *
 * Lifecycle:
 *   - lazy spawn on first sendToAgent
 *   - closed via closeAgent() from team-down or harness session_end
 *   - if the process dies mid-run, currentTurn is rejected and the next
 *     sendToAgent respawns (session file on disk lets pi resume context)
 */

interface PendingTurn {
	textChunks: string[];
	onTextDelta?: (delta: string) => void;
	onThinkingDelta?: (delta: string) => void;
	onStderr?: (chunk: string) => void;
	resolve: (r: SendResult) => void;
	signal?: AbortSignal;
	abortListener?: () => void;
}

export interface AgentRuntime {
	def: AgentDef;
	sessionFile: string;
	turns: number;
	usage: AgentUsage;
	// Persistent-process state — see ensureProc / sendToAgent.
	proc: ChildProcess | null;
	eventBuffer: string;
	stderrTail: string;
	systemPromptInjected: boolean;
	currentTurn: PendingTurn | null;
	tmpPromptFile: string | null;
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

const STDERR_TAIL_BYTES = 4096;

export function makeRuntime(def: AgentDef, runDir: string): AgentRuntime {
	const sessionsDir = join(runDir, "sessions");
	mkdirSync(sessionsDir, { recursive: true });
	return {
		def,
		sessionFile: join(sessionsDir, `${def.role}.json`),
		turns: 0,
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		proc: null,
		eventBuffer: "",
		stderrTail: "",
		systemPromptInjected: false,
		currentTurn: null,
		tmpPromptFile: null,
	};
}

function ensureProc(runtime: AgentRuntime, cwd: string): void {
	if (runtime.proc && !runtime.proc.killed && runtime.proc.exitCode === null) return;

	const args: string[] = [
		"--mode", "rpc",
		"--no-extensions",
		"--no-skills",
		"--no-context-files",
		"--no-prompt-templates",
		"--thinking", "off",
	];

	if (runtime.def.model) args.push("--model", runtime.def.model);
	if (runtime.def.tools.length > 0) args.push("--tools", runtime.def.tools.join(","));

	args.push("--session", runtime.sessionFile);

	if (!runtime.systemPromptInjected && runtime.def.systemPrompt.trim()) {
		const tmpDir = mkdtempSync(join(tmpdir(), "pi-team-"));
		const tmpFile = join(tmpDir, `${runtime.def.role}.md`);
		writeFileSync(tmpFile, runtime.def.systemPrompt, { encoding: "utf8", mode: 0o600 });
		runtime.tmpPromptFile = tmpFile;
		args.push("--append-system-prompt", tmpFile);
		runtime.systemPromptInjected = true;
	}

	const proc = spawn("pi", args, {
		cwd,
		stdio: ["pipe", "pipe", "pipe"],
		env: { ...process.env },
	});
	runtime.proc = proc;
	runtime.eventBuffer = "";

	proc.stdout!.setEncoding("utf8");
	proc.stdout!.on("data", (chunk: string) => {
		runtime.eventBuffer += chunk;
		while (true) {
			const nl = runtime.eventBuffer.indexOf("\n");
			if (nl === -1) break;
			let line = runtime.eventBuffer.slice(0, nl);
			runtime.eventBuffer = runtime.eventBuffer.slice(nl + 1);
			if (line.endsWith("\r")) line = line.slice(0, -1);
			if (!line.trim()) continue;
			try { handleEvent(runtime, JSON.parse(line)); } catch { /* non-JSON noise */ }
		}
	});

	proc.stderr!.setEncoding("utf8");
	proc.stderr!.on("data", (chunk: string) => {
		runtime.stderrTail = (runtime.stderrTail + chunk).slice(-STDERR_TAIL_BYTES);
		runtime.currentTurn?.onStderr?.(chunk);
	});

	proc.on("close", (code) => {
		const turn = runtime.currentTurn;
		runtime.proc = null;
		runtime.currentTurn = null;
		runtime.eventBuffer = "";
		if (runtime.tmpPromptFile) {
			try { unlinkSync(runtime.tmpPromptFile); } catch { /* ignore */ }
			runtime.tmpPromptFile = null;
		}
		if (turn) {
			detachAbort(turn);
			turn.resolve({
				text: turn.textChunks.join(""),
				exitCode: code ?? 1,
				stderr: runtime.stderrTail,
			});
		}
	});

	proc.on("error", (err) => {
		runtime.stderrTail = (runtime.stderrTail + `\nspawn error: ${err.message}`).slice(-STDERR_TAIL_BYTES);
	});
}

function handleEvent(runtime: AgentRuntime, event: any): void {
	const turn = runtime.currentTurn;

	// Auto-respond to extension UI requests so the agent never blocks waiting
	// for a human. Workers shouldn't trigger these often (locked tool list)
	// but a stray danger-pattern bash would otherwise hang forever.
	if (event.type === "extension_ui_request") {
		const id = event.id;
		const method = event.method;
		if (method === "confirm") {
			writeJsonl(runtime, { type: "extension_ui_response", id, confirmed: false });
		} else if (method === "select" || method === "input" || method === "editor") {
			writeJsonl(runtime, { type: "extension_ui_response", id, cancelled: true });
		}
		// notify / setStatus / setWidget / setTitle / set_editor_text are
		// fire-and-forget; ignore.
		return;
	}

	if (!turn) return;

	if (event.type === "message_update") {
		const delta = event.assistantMessageEvent;
		if (delta?.type === "text_delta" && typeof delta.delta === "string") {
			turn.textChunks.push(delta.delta);
			turn.onTextDelta?.(delta.delta);
		} else if (delta?.type === "thinking_delta" && typeof delta.delta === "string") {
			turn.onThinkingDelta?.(delta.delta);
		}
		return;
	}

	if (event.type === "message_end" && event.message) {
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
		return;
	}

	if (event.type === "agent_end") {
		runtime.turns++;
		const text = turn.textChunks.join("");
		detachAbort(turn);
		runtime.currentTurn = null;
		turn.resolve({ text, exitCode: 0, stderr: runtime.stderrTail });
		return;
	}
}

function writeJsonl(runtime: AgentRuntime, obj: unknown): void {
	const proc = runtime.proc;
	if (!proc || !proc.stdin || proc.stdin.destroyed) return;
	proc.stdin.write(JSON.stringify(obj) + "\n");
}

function detachAbort(turn: PendingTurn): void {
	if (turn.signal && turn.abortListener) {
		turn.signal.removeEventListener("abort", turn.abortListener);
		turn.abortListener = undefined;
	}
}

export function sendToAgent(runtime: AgentRuntime, opts: SendOptions): Promise<SendResult> {
	if (runtime.currentTurn) {
		return Promise.resolve({
			text: "",
			exitCode: 1,
			stderr: "concurrent sendToAgent on the same runtime is not supported",
		});
	}

	try {
		ensureProc(runtime, opts.cwd);
	} catch (err) {
		return Promise.resolve({
			text: "",
			exitCode: 1,
			stderr: `spawn failed: ${(err as Error).message}`,
		});
	}

	return new Promise<SendResult>((resolveResult) => {
		const turn: PendingTurn = {
			textChunks: [],
			onTextDelta: opts.onTextDelta,
			onThinkingDelta: opts.onThinkingDelta,
			onStderr: opts.onStderr,
			resolve: (r) => {
				opts.onTurnComplete?.(r.text, runtime.usage);
				resolveResult(r);
			},
			signal: opts.signal,
		};
		runtime.currentTurn = turn;

		if (opts.signal) {
			turn.abortListener = () => {
				writeJsonl(runtime, { type: "abort" });
			};
			if (opts.signal.aborted) turn.abortListener();
			else opts.signal.addEventListener("abort", turn.abortListener, { once: true });
		}

		writeJsonl(runtime, { type: "prompt", message: opts.prompt });
	});
}

/**
 * Tear down the long-lived rpc subprocess. Best-effort: send SIGTERM, then
 * SIGKILL after a grace window. Used by team-down and the harness shutdown
 * hook so a Ctrl-C in pi-team doesn't leave dangling children.
 */
export function closeAgent(runtime: AgentRuntime): Promise<void> {
	const proc = runtime.proc;
	if (!proc) return Promise.resolve();

	return new Promise<void>((resolve) => {
		const onClose = () => resolve();
		proc.once("close", onClose);
		try {
			if (proc.stdin && !proc.stdin.destroyed) proc.stdin.end();
		} catch { /* ignore */ }
		try { proc.kill("SIGTERM"); } catch { /* ignore */ }
		setTimeout(() => {
			if (proc.exitCode === null && !proc.killed) {
				try { proc.kill("SIGKILL"); } catch { /* ignore */ }
			}
		}, 3000);
		// Safety: resolve after 5s regardless so shutdown isn't blocked.
		setTimeout(resolve, 5000);
	});
}
