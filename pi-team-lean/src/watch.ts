import { existsSync, readFileSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import { eventLogPath, latestRunId, readEvents, type TeamLeanEvent } from "./events.js";
import type { SprintState, StoryStatus } from "./types.js";

const CSI = "\x1b[";
const clear = () => process.stdout.write(`${CSI}?25l${CSI}2J${CSI}H`);
const restore = () => process.stdout.write(`${CSI}?25h${CSI}0m`);
const moveHome = () => process.stdout.write(`${CSI}H`);
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");
const widthOf = (s: string): number => stripAnsi(s).length;
const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
};

const pad = (s: string, n: number): string => {
  const w = widthOf(s);
  if (w >= n) return truncate(s, n);
  return s + " ".repeat(n - w);
};

const truncate = (s: string, n: number): string => {
  const plain = stripAnsi(s);
  if (plain.length <= n) return s;
  if (n <= 1) return plain.slice(0, n);
  return plain.slice(0, n - 1) + "…";
};

const boxLine = (width: number, left: string, fill = "─", right = ""): string => {
  const inner = Math.max(0, width - widthOf(left) - widthOf(right));
  return left + fill.repeat(inner) + right;
};

const statusIcon = (status: StoryStatus): string => {
  if (status === "merged") return color.green("✓");
  if (status === "failed") return color.red("✗");
  if (status === "skipped") return color.yellow("↷");
  if (status === "in_progress") return color.cyan("▶");
  return color.dim("○");
};

const statusText = (status: StoryStatus): string => {
  if (status === "merged") return color.green(status);
  if (status === "failed") return color.red(status);
  if (status === "skipped") return color.yellow(status);
  if (status === "in_progress") return color.cyan(status);
  return color.dim(status);
};

const readState = (repoCwd: string): SprintState | undefined => {
  const path = join(repoCwd, ".pi-team-lean", "sprint-state.json");
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SprintState;
  } catch {
    return undefined;
  }
};

const eventLabel = (e: TeamLeanEvent): string => {
  const time = e.timestamp.slice(11, 19);
  switch (e.type) {
    case "run_started": return `${time} ${color.bold("run")} started ${e.runId} (${e.storyCount} stories)`;
    case "run_finished": return `${time} ${color.green("run finished")} ${e.stagingBranch}`;
    case "story_started": return `${time} ${color.cyan("story")} ${e.storyId}: ${e.title}`;
    case "story_finished": return `${time} ${statusText(e.status)} ${e.storyId}${e.failureReason ? ` — ${e.failureReason.split("\n")[0]}` : ""}`;
    case "story_skipped": return `${time} ${color.yellow("skip")} ${e.storyId}: ${e.reason}`;
    case "phase_started": return `${time} ${color.magenta(e.phase)}${e.storyId ? ` ${e.storyId}` : ""}${e.iteration ? ` iter ${e.iteration}/${e.totalIterations ?? "?"}` : ""}${e.detail ? ` — ${e.detail}` : ""}`;
    case "phase_finished": return `${time} ${e.ok ? color.green("ok") : color.red("fail")} ${e.phase}${e.storyId ? ` ${e.storyId}` : ""}${e.detail ? ` — ${e.detail.split("\n")[0]}` : ""}`;
    case "pi_stdout": return `${time} ${color.dim("pi>")} ${e.line}`;
    case "pi_stderr": return `${time} ${color.red("pi!")} ${e.line}`;
    case "test_output": return `${time} ${e.ok ? color.green("test ok") : color.red("test fail")} ${e.storyId} ${e.phase}`;
    case "artifact_written": return `${time} ${color.dim("artifact")} ${e.storyId}/${e.name}`;
    case "git": return `${time} ${color.dim("git")} ${e.action} ${e.branch ?? e.fromBranch ?? ""}`;
    case "state_written": return `${time} ${color.dim("state")} ${e.path}`;
    case "log": return `${time} ${e.message}`;
  }
};

const currentActivity = (events: TeamLeanEvent[]): string => {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "pi_stdout") return `Pi ${e.phase} ${e.storyId}: ${e.line}`;
    if (e.type === "phase_started") return `${e.phase}${e.storyId ? ` for ${e.storyId}` : ""}${e.detail ? ` — ${e.detail}` : ""}`;
    if (e.type === "story_started") return `story ${e.storyId}: ${e.title}`;
    if (e.type === "run_finished") return `finished on ${e.stagingBranch}`;
  }
  return "waiting for events…";
};

const render = (repoCwd: string, runId: string, logPath: string): void => {
  const width = Math.max(60, process.stdout.columns || 100);
  const height = Math.max(20, process.stdout.rows || 32);
  const state = readState(repoCwd);
  const events = readEvents(logPath);
  const storyWidth = Math.min(38, Math.max(24, Math.floor(width * 0.34)));
  const timelineWidth = width - storyWidth - 3;
  const bodyHeight = height - 7;
  const stories = state ? Object.entries(state.stories) : [];
  const recentEvents = events.slice(-bodyHeight);

  const lines: string[] = [];
  lines.push(boxLine(width, `┌ ${color.bold("Pi Team Lean")} `, "─", "┐"));
  lines.push(`│ ${pad(color.dim("repo ") + repoCwd, width - 4)} │`);
  lines.push(`│ ${pad(color.dim("run  ") + runId + (state ? `  ${color.dim("staging ")}${state.staging_branch}` : ""), width - 4)} │`);
  lines.push(`├${"─".repeat(storyWidth)}┬${"─".repeat(timelineWidth)}┤`);
  lines.push(`│${pad(color.bold(" Stories"), storyWidth)}│${pad(color.bold(" Timeline"), timelineWidth)}│`);

  for (let i = 0; i < bodyHeight; i++) {
    const story = stories[i];
    const left = story
      ? ` ${statusIcon(story[1].status)} ${story[0]} ${statusText(story[1].status)}`
      : "";
    const event = recentEvents[i];
    const right = event ? ` ${eventLabel(event)}` : "";
    lines.push(`│${pad(left, storyWidth)}│${pad(right, timelineWidth)}│`);
  }

  lines.push(`├${"─".repeat(width - 2)}┤`);
  lines.push(`│ ${pad(color.bold("Current: ") + currentActivity(events), width - 4)} │`);
  lines.push(`└${pad(color.dim(" q quit • ctrl-c quit • auto-refreshing "), width - 2,)}┘`);

  moveHome();
  process.stdout.write(lines.map((l) => truncate(l, width)).join("\n"));
};

export const runWatch = (argv: string[]): number => {
  const cwdIdx = argv.indexOf("--cwd");
  const repoCwd = cwdIdx >= 0 ? resolve(argv[cwdIdx + 1]!) : process.cwd();
  const runIdx = argv.indexOf("--run");
  const runId = runIdx >= 0 ? argv[runIdx + 1] : latestRunId(repoCwd);
  if (!runId) {
    console.error(`[pi-team-lean] No runs found in ${join(repoCwd, ".pi-team-lean", "runs")}`);
    return 2;
  }
  const logPath = eventLogPath(repoCwd, runId);

  clear();
  const rerender = () => render(repoCwd, runId, logPath);
  rerender();
  const interval = setInterval(rerender, 1000);
  const watchers = [
    existsSync(logPath) ? watch(logPath, rerender) : undefined,
    existsSync(join(repoCwd, ".pi-team-lean", "sprint-state.json")) ? watch(join(repoCwd, ".pi-team-lean", "sprint-state.json"), rerender) : undefined,
  ].filter(Boolean) as Array<{ close(): void }>;

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (buf: Buffer) => {
      const s = buf.toString("utf8");
      if (s === "q" || s === "\u0003") {
        for (const w of watchers) w.close();
        clearInterval(interval);
        restore();
        process.stdout.write("\n");
        process.exit(0);
      }
    });
  }
  process.on("SIGINT", () => {
    for (const w of watchers) w.close();
    clearInterval(interval);
    restore();
    process.exit(0);
  });
  return 0;
};
