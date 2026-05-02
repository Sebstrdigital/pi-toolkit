import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface RunPaths {
  root: string;
  storyDir(storyId: string): string;
  artifact(storyId: string, name: string): string;
}

export const runPaths = (repoCwd: string, runId: string): RunPaths => {
  const root = join(repoCwd, ".pi-team-lean", "runs", runId);
  return {
    root,
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
  writeFileSync(path, content);
};

export const writeJsonArtifact = (path: string, obj: unknown): void => {
  writeFileSync(path, JSON.stringify(obj, null, 2));
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
  qaScript: "qa-script.sh",
  qaScriptOutput: "qa-script.output.log",
  testCommandOutput: "test-command.output.log",
  scenarioJudgement: "scenario-judgement.json",
  reviewerJudgement: "reviewer-judgement.json",
  meta: "meta.json",
} as const;
