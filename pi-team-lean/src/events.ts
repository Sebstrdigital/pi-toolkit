import { appendFileSync, mkdirSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StoryStatus } from "./types.js";

export type TeamLeanPhase =
  | "preflight"
  | "staging"
  | "worker"
  | "reviewer"
  | "verify"
  | "qa-script"
  | "acceptance"
  | "scenario-judge"
  | "merge";

export type TeamLeanEvent =
  | { type: "run_started"; timestamp: string; runId: string; cwd: string; sprintPath: string; baseBranch: string; stagingBranch: string; storyCount: number }
  | { type: "run_finished"; timestamp: string; runId: string; stagingBranch: string; summary: Array<{ id: string; status: StoryStatus }> }
  | { type: "log"; timestamp: string; message: string }
  | { type: "state_written"; timestamp: string; path: string }
  | { type: "story_started"; timestamp: string; storyId: string; title: string; branch?: string }
  | { type: "story_finished"; timestamp: string; storyId: string; status: StoryStatus; failureReason?: string }
  | { type: "story_skipped"; timestamp: string; storyId: string; reason: string }
  | { type: "phase_started"; timestamp: string; storyId?: string; phase: TeamLeanPhase; detail?: string; iteration?: number; totalIterations?: number }
  | { type: "phase_finished"; timestamp: string; storyId?: string; phase: TeamLeanPhase; ok: boolean; detail?: string; iteration?: number }
  | { type: "pi_stdout"; timestamp: string; storyId: string; phase: TeamLeanPhase; line: string; iteration?: number }
  | { type: "pi_stderr"; timestamp: string; storyId: string; phase: TeamLeanPhase; line: string; iteration?: number }
  | { type: "test_output"; timestamp: string; storyId: string; phase: "verify" | "acceptance"; ok: boolean; tail: string }
  | { type: "artifact_written"; timestamp: string; storyId: string; name: string; path: string }
  | { type: "git"; timestamp: string; action: "cut_branch" | "checkout" | "merge" | "merge_abort" | "merge_revert" | "delete_branch"; branch?: string; fromBranch?: string; intoBranch?: string; message?: string }
  /** A safety gate (reviewer / scenario-judge) degraded to a fail-closed verdict due to infrastructure failure, NOT a real review. */
  | { type: "degraded_gate"; timestamp: string; storyId: string; gate: "reviewer" | "scenario-judge"; reason: string }
  /** A diff was truncated before being shown to a gate/qa-author — recorded so the blind spot is auditable. */
  | { type: "diff_truncated"; timestamp: string; storyId: string; phase: TeamLeanPhase; omitted: number; cap: number }
  /** The bounded-retry loop made no progress between iterations (identical diff/failure signature) — parking. */
  | { type: "no_progress"; timestamp: string; storyId: string; iteration: number; signature: string }
  /** The qa-author acceptance script was rejected by the pre-exec content gate (never executed). */
  | { type: "sandbox_rejected"; timestamp: string; storyId: string; reason: string }
  /** Post-merge verification on staging (re-run of the test command after merge). */
  | { type: "postmerge_verify"; timestamp: string; storyId: string; ok: boolean; reverted: boolean };

export type TeamLeanEventInput = {
  [K in TeamLeanEvent["type"]]: Omit<Extract<TeamLeanEvent, { type: K }>, "timestamp">;
}[TeamLeanEvent["type"]];

export interface EventWriter {
  path: string;
  emit(event: TeamLeanEventInput): void;
}

export const createEventWriter = (path: string): EventWriter => {
  mkdirSync(dirname(path), { recursive: true });
  return {
    path,
    emit(event) {
      const withTime = { timestamp: new Date().toISOString(), ...event } as TeamLeanEvent;
      appendFileSync(path, `${JSON.stringify(withTime)}\n`);
    },
  };
};

export const readEvents = (path: string): TeamLeanEvent[] => {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TeamLeanEvent);
};

export const latestRunId = (repoCwd: string): string | undefined => {
  const runsDir = join(repoCwd, ".pi-team-lean", "runs");
  if (!existsSync(runsDir)) return undefined;
  const dirs = readdirSync(runsDir)
    .map((name) => ({ name, path: join(runsDir, name) }))
    .filter((d) => {
      try {
        return statSync(d.path).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b.path).mtimeMs - statSync(a.path).mtimeMs);
  return dirs[0]?.name;
};

export const eventLogPath = (repoCwd: string, runId: string): string =>
  join(repoCwd, ".pi-team-lean", "runs", runId, "events.jsonl");
