import { mkdirSync, writeFileSync, appendFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";

/**
 * Write a file atomically: write to a sibling temp file then rename over the
 * target. rename(2) is atomic on POSIX, so a crash mid-write can never leave a
 * truncated/partial state file behind (the previous bare writeFileSync could
 * leave sprint-state.json half-written → a resume reading garbage JSON). The
 * temp file lives in the same directory so the rename stays on one filesystem.
 */
export const writeFileAtomic = (path: string, content: string): void => {
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
};

export interface RunPaths {
  root: string;
  events: string;
  state: string;
  storyDir(storyId: string): string;
  artifact(storyId: string, name: string): string;
}

export const runPaths = (repoCwd: string, runId: string): RunPaths => {
  const root = join(repoCwd, ".pi-team-lean", "runs", runId);
  return {
    root,
    events: join(root, "events.jsonl"),
    state: join(root, "sprint-state.json"),
    storyDir: (storyId) => {
      const dir = join(root, storyId);
      mkdirSync(dir, { recursive: true });
      return dir;
    },
    artifact: (storyId, name) => {
      mkdirSync(join(root, storyId), { recursive: true });
      return join(root, storyId, name);
    },
  };
};

export const writeArtifact = (path: string, content: string): void => {
  writeFileAtomic(path, content);
};

export const writeJsonArtifact = (path: string, obj: unknown): void => {
  writeFileAtomic(path, JSON.stringify(obj, null, 2));
};

export const appendArtifact = (path: string, line: string): void => {
  if (!existsSync(path)) writeFileSync(path, "");
  appendFileSync(path, line.endsWith("\n") ? line : `${line}\n`);
};

export const ARTIFACTS = {
  workerStdout: "worker.stdout.log",
  workerStderr: "worker.stderr.log",
  workerDiff: "worker.diff",
  qaSpec: "qa-spec.yml",
  testCommandOutput: "test-command.output.log",
  scenarioJudgement: "scenario-judgement.json",
  reviewerJudgement: "reviewer-judgement.json",
  meta: "meta.json",
} as const;
