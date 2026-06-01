import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { relative, join, resolve } from "node:path";
import { runPi } from "./pi.js";
import { qaScriptPrompt, workerPrompt } from "./prompts.js";
import {
  ensureCleanTree,
  cutBranch,
  checkout,
  branchExists,
  tryMergeNoFf,
  resetHard,
  isReachableFrom,
  deleteBranch,
  localBranchHeads,
  commitsOnBranch,
  diffBetween,
  headSha,
} from "./git.js";
import { runSandboxed } from "./sandbox.js";
import { allowListedEnv } from "./env.js";
import { runPaths, writeArtifact, writeJsonArtifact, writeFileAtomic, ARTIFACTS } from "./runs.js";
import { createEventWriter } from "./events.js";
import { runWatch } from "./watch.js";
import { scenariosForStory } from "./features.js";
import { judgeScenarios } from "./scenarios.js";
import { runReview, reviewerFeedbackForWorker, type ReviewResult } from "./reviewer.js";
import { cliPreflight } from "./preflight.js";
import type { Sprint, SprintState, StoryState, Story, StoryStatus } from "./types.js";

const DEFAULT_WORKER_TIMEOUT_MIN = 15;
const DEFAULT_QA_TIMEOUT_MIN = 10;
const DEFAULT_TEST_TIMEOUT_MIN = 30;

const log = (msg: string): void => console.log(`[pi-team-lean] ${msg}`);

/** Feedback fed back into the next worker attempt when a phase fails (bounded-retry loop). */
const workerCrashFeedback = (reason: string, stderr: string): string => `# Previous attempt did not produce a usable commit

${reason}

\`\`\`
${stderr.slice(-2000)}
\`\`\`

Implement the story, run the tests, and commit your work with \`git add -A && git commit\`.`;

const testFailureFeedback = (output: string): string => `# Test failure feedback

Your previous commit did not pass the project test command. Find the cause and fix it, then commit again.

\`\`\`
${output.slice(-4000)}
\`\`\`

Do not weaken, skip, or delete tests to make them pass. Commit with: \`git add -A && git commit -m "fix: address failing tests"\``;

const acceptanceFailureFeedback = (output: string): string => `# Acceptance failure feedback

The implementation passed unit tests but FAILED the acceptance checks below. The acceptance script encodes the story's intent — make the behaviour satisfy it. Fix and commit again.

\`\`\`
${output.slice(-4000)}
\`\`\`

Do not edit the acceptance script — fix the implementation. Commit with: \`git add -A && git commit -m "fix: satisfy acceptance checks"\``;

const topoSort = (stories: Story[]): Story[] => {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const result: Story[] = [];
  const visit = (s: Story, stack: Set<string>): void => {
    if (visited.has(s.id)) return;
    if (stack.has(s.id)) throw new Error(`Cyclic dependency at ${s.id}`);
    stack.add(s.id);
    for (const dep of s.depends_on ?? []) {
      const d = byId.get(dep);
      if (!d) throw new Error(`Story ${s.id} depends on unknown ${dep}`);
      visit(d, stack);
    }
    stack.delete(s.id);
    visited.add(s.id);
    result.push(s);
  };
  for (const s of stories) visit(s, new Set());
  return result;
};

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`;

const branchRunId = (branch: string): string =>
  branch
    .replace(/^pi-team-lean\//, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "staging";

const readSprintState = (path: string): SprintState | undefined => {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SprintState;
  } catch {
    return undefined;
  }
};

const initialSprintState = (stories: Story[], baseBranch: string, stagingBranch: string): SprintState => ({
  started_at: new Date().toISOString(),
  base_branch: baseBranch,
  staging_branch: stagingBranch,
  stories: Object.fromEntries(stories.map((s) => [s.id, { status: "pending" } as StoryState])),
});

const mergeSprintState = (state: SprintState, stories: Story[]): SprintState => ({
  ...state,
  stories: {
    ...Object.fromEntries(stories.map((s) => [s.id, { status: "pending" } as StoryState])),
    ...state.stories,
  },
});

const openTmuxWatcher = (repoCwd: string, runId: string): void => {
  if (!process.env.TMUX) {
    log("WARN  --tmux-ui requested but this process is not inside tmux; run `pi-team-lean tui --cwd ... --run ...` manually");
    return;
  }
  const command = `pi-team-lean watch --cwd ${shellQuote(repoCwd)} --run ${shellQuote(runId)}`;
  try {
    execFileSync("tmux", ["split-window", "-h", "-c", repoCwd, command], {
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
    log(`Opened right-side tmux watcher pane for run ${runId}`);
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const detail = err.stderr?.toString() ?? err.message ?? "unknown error";
    log(`WARN  failed to open tmux watcher pane: ${detail.trim()}`);
  }
};

export const runTestCommand = (cmd: string, cwd: string, timeoutMs: number): { ok: boolean; output: string; timedOut: boolean } => {
  try {
    const output = execFileSync("sh", ["-c", cmd], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
      // Explicit allow-listed env: the test command is config/LLM-influenced and
      // must not inherit the operator's full secret-bearing process.env
      // (qa-script-arbitrary-exec, exfil half).
      env: allowListedEnv(),
    });
    return { ok: true, output, timedOut: false };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; signal?: string; code?: string };
    const out = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
    const timedOut = err.signal === "SIGTERM" || err.code === "ETIMEDOUT";
    const timeoutNote = timedOut ? `\ntest_command timed out after ${Math.round(timeoutMs / 1000)}s\n` : "";
    return { ok: false, output: `${out}${timeoutNote}`, timedOut };
  }
};

/** Max accumulated retry-feedback length kept across iterations (cap to avoid unbounded prompt growth). */
const MAX_FEEDBACK_CHARS = 8000;

/**
 * Append a new feedback block to the accumulated feedback, newest last, capped.
 * Previously each phase OVERWROTE `feedback`, so the worker lost the history of
 * what it had already tried and looped on the same mistake
 * (feedback-overwrite-not-accumulate).
 */
export const accumulateFeedback = (prev: string, next: string, iter: number): string => {
  const block = `<!-- feedback from iteration ${iter} -->\n${next}`;
  const combined = prev ? `${prev}\n\n---\n\n${block}` : block;
  // Keep the tail (most recent) when over budget.
  return combined.length > MAX_FEEDBACK_CHARS ? combined.slice(-MAX_FEEDBACK_CHARS) : combined;
};

/**
 * Stable signature of an attempt's outcome, used by the no-progress guard. Two
 * consecutive iterations with the same worker diff AND same failure signature
 * mean the loop is stuck — park instead of burning the remaining budget.
 */
export const attemptSignature = (workerDiff: string, failureKind: string, failureOutput: string): string => {
  const norm = (s: string): string => s.replace(/\s+/g, " ").trim().slice(0, 4000);
  return `${failureKind}::${norm(failureOutput)}::${norm(workerDiff)}`;
};

const resolveStoryCwd = (repoCwd: string, story: Story): string => {
  const storyCwd = resolve(repoCwd, story.repo_path ?? ".");
  const rel = relative(repoCwd, storyCwd);
  if (rel.startsWith("..") || resolve(rel) === rel) {
    throw new Error(`Story ${story.id} repo_path escapes --cwd: ${story.repo_path}`);
  }
  return storyCwd;
};

const ensureStagingBranch = (
  stagingBranch: string,
  storyBaseBranch: string,
  cwd: string,
  events: ReturnType<typeof createEventWriter>,
): void => {
  if (!branchExists(stagingBranch, cwd)) {
    cutBranch(stagingBranch, storyBaseBranch, cwd);
    events.emit({ type: "git", action: "cut_branch", branch: stagingBranch, fromBranch: storyBaseBranch });
    log(`Cut staging from ${storyBaseBranch} in ${cwd}`);
  } else {
    checkout(stagingBranch, cwd);
    events.emit({ type: "git", action: "checkout", branch: stagingBranch });
    log(`Resumed staging in ${cwd}`);
  }
};

/**
 * Per-run state shared across all stories in a sprint. Built once by runSprint
 * and threaded into each runStory call so a story can run standalone (board /
 * daemon callers) without re-deriving the whole setup.
 */
export interface RunContext {
  sprint: Sprint;
  repoCwd: string;
  baseBranch: string;
  stagingBranch: string;
  runId: string;
  testCommand: string;
  acceptDir: string;
  paths: ReturnType<typeof runPaths>;
  events: ReturnType<typeof createEventWriter>;
  state: SprintState;
  persist: () => void;
  emitArtifact: (storyId: string, name: string, path: string) => void;
}

/**
 * Run a single story end-to-end on its own feature branch: worker (+ optional
 * reviewer loop) → verify → qa-script → acceptance → scenario-judge → merge.
 * Mutates ctx.state for this story and persists; returns when the story reaches
 * a terminal state (merged / failed / skipped). Does not throw on story failure.
 */
export const runStory = async (story: Story, ctx: RunContext): Promise<void> => {
  const { sprint, baseBranch, stagingBranch, runId, testCommand, acceptDir, paths, events, state, persist, emitArtifact } = ctx;
  const ss = state.stories[story.id]!;
  const featureBranch = `pi-team-lean/${runId}/story-${story.id}`;
  const reconcileCwd = resolveStoryCwd(ctx.repoCwd, story);

  // --- Resume reconciliation (state-isolation-resume-staleness) ---
  // Recorded state and git ground truth can diverge (crash between mergeNoFf and
  // persist, kill -9, hand-edited state). Reconcile against git before trusting
  // the recorded status instead of blindly short-circuiting on 'merged' or
  // re-cutting an existing feature branch (which FATAL-ed `git checkout -b`).
  if (ss.status === "merged") {
    const tip = ss.commits?.[0];
    const reachable = tip ? isReachableFrom(tip, stagingBranch, reconcileCwd) : true;
    if (reachable) {
      log(`SKIP  ${story.id}: already merged (verified reachable from ${stagingBranch})`);
      return;
    }
    // State says merged but the commit is NOT on staging — the post-merge state
    // write must have landed before the merge actually persisted, or staging was
    // rewound. Re-run from scratch rather than silently skipping unmerged work.
    log(`RECONCILE ${story.id}: recorded 'merged' but commit not reachable from ${stagingBranch} — re-running`);
    events.emit({ type: "log", message: `reconcile ${story.id}: merged-but-unreachable, re-running` });
    ss.status = "pending";
  }
  // A leftover feature branch from a crashed/interrupted prior attempt would make
  // the upcoming `git checkout -b` FATAL. Delete it so the re-run starts clean.
  // (Reached only for a non-merged story: the merged+reachable case already
  // returned, and merged-but-unreachable was reset to 'pending' above.)
  if (branchExists(featureBranch, reconcileCwd)) {
    log(`RECONCILE ${story.id}: deleting stale feature branch ${featureBranch}`);
    deleteBranch(featureBranch, reconcileCwd);
    events.emit({ type: "git", action: "delete_branch", branch: featureBranch });
  }
  const blockers = (story.depends_on ?? []).filter((d) => state.stories[d]?.status !== "merged");
  if (blockers.length > 0) {
    ss.status = "skipped";
    ss.failure_reason = `blocked by ${blockers.join(", ")}`;
    log(`SKIP  ${story.id}: ${ss.failure_reason}`);
    events.emit({ type: "story_skipped", storyId: story.id, reason: ss.failure_reason });
    persist();
    return;
  }

  ss.status = "in_progress";
  ss.started_at = new Date().toISOString();
  ss.repo_path = story.repo_path ?? ".";
  persist();
  log(`---- ${story.id}: ${story.title} ----`);
  events.emit({ type: "story_started", storyId: story.id, title: story.title });

  paths.storyDir(story.id);
  const acceptPath = join(acceptDir, `${story.id}.sh`);
  const storyCwd = resolveStoryCwd(ctx.repoCwd, story);
  const storyBaseBranch = story.base_branch ?? baseBranch;
  ensureStagingBranch(stagingBranch, storyBaseBranch, storyCwd, events);

  // 1. Cut feature branch from staging, run worker (worker does NOT see acceptance criteria)
  events.emit({ type: "phase_started", storyId: story.id, phase: "staging", detail: `cut ${featureBranch}` });
  cutBranch(featureBranch, stagingBranch, storyCwd);
  events.emit({ type: "git", action: "cut_branch", branch: featureBranch, fromBranch: stagingBranch });
  events.emit({ type: "phase_finished", storyId: story.id, phase: "staging", ok: true, detail: featureBranch });
  ss.branch = featureBranch;
  persist();

  const maxIter = Math.max(1, sprint.max_iterations ?? sprint.max_review_iterations ?? 3);
  const testTimeoutMin = story.test_timeout_min ?? sprint.test_timeout_min ?? DEFAULT_TEST_TIMEOUT_MIN;
  const testTimeoutMs = testTimeoutMin * 60 * 1000;
  const retry = {
    worker: sprint.retry_on?.worker ?? true,
    reviewer: sprint.retry_on?.reviewer ?? true,
    test: sprint.retry_on?.test ?? true,
    acceptance: sprint.retry_on?.acceptance ?? true,
  };

  /** Terminal exit for a story: restore staging, record status, emit, persist. */
  const endStory = (status: StoryStatus, reason: string): void => {
    ss.status = status;
    ss.failure_reason = reason;
    // Guard the teardown checkout: a failure here (dirty tree, conflict, a
    // committed .pi-team-lean/, etc.) must not throw out of runStory and abort
    // the WHOLE sprint — this story is already terminal; just continue.
    try {
      checkout(stagingBranch, storyCwd);
      events.emit({ type: "git", action: "checkout", branch: stagingBranch });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      log(`WARN  ${story.id}: could not restore ${stagingBranch} (${m.split("\n")[0]}); continuing`);
      events.emit({ type: "log", message: `endStory checkout failed for ${story.id}: ${m}` });
    }
    log(`${status === "needs_human" ? "PARK" : "FAIL"}  ${story.id}: ${reason.split("\n")[0]}`);
    ss.ended_at = new Date().toISOString();
    events.emit({ type: "story_finished", storyId: story.id, status, failureReason: reason });
    persist();
  };
  const noteRetry = (phase: string, iter: number): void => {
    log(`retry ${story.id}: ${phase} failed — attempt ${iter + 1}/${maxIter}`);
    events.emit({ type: "log", message: `retry ${story.id}: ${phase} failed, attempt ${iter + 1}/${maxIter}` });
  };

  /**
   * no-progress guard: if this iteration's (worker diff + failure signature) is
   * identical to the previous one, the worker is stuck reproducing the same
   * failure and burning budget — park now instead of looping
   * (feedback-overwrite-not-accumulate companion guard). Returns true when the
   * caller should stop (the story has been parked).
   */
  const stuckOnSameFailure = (phase: string, iter: number, failureOutput: string): boolean => {
    const sig = attemptSignature(workerDiff, phase, failureOutput);
    if (lastSignature !== undefined && sig === lastSignature) {
      events.emit({ type: "no_progress", storyId: story.id, iteration: iter, signature: phase });
      endStory("needs_human", `no progress: ${phase} produced an identical diff + failure two iterations in a row (iter ${iter})`);
      return true;
    }
    lastSignature = sig;
    return false;
  };

  let workerDiff = "";
  let lastReview: ReviewResult | undefined;
  let feedback = "";
  let lastSignature: string | undefined;

  // worker-commit-guard (worker-commit-guard-fragile): snapshot the tip of every
  // local branch EXCEPT the feature branch before the worker runs. After the
  // worker we assert none of them moved — the worker prompt forbids touching any
  // branch but its own, so a moved staging/main/other ref means the worker
  // escaped scope (or pushed/merged) and the story must be parked, not merged.
  const branchHeadsBeforeWorker = localBranchHeads(storyCwd);

  // Bounded delivery loop: worker → reviewer → verify → acceptance. Any phase
  // failure (with budget + retry enabled) feeds typed feedback back to the next
  // worker attempt; on cap-exceed the story parks as needs_human (never a silent
  // merge). A phase whose retry toggle is off fails hard instead of parking.
  for (let iter = 1; iter <= maxIter; iter++) {
    ss.iterations = iter;
    persist();

    // 1. Worker implements (sees accumulated feedback from any prior failed phase)
    const timeoutMin = story.worker_timeout_min ?? sprint.worker_timeout_min ?? DEFAULT_WORKER_TIMEOUT_MIN;
    const timeoutMs = timeoutMin * 60 * 1000;
    log(`worker: implementing on ${featureBranch} (iter ${iter}/${maxIter}${feedback ? ", with feedback" : ""}, timeout ${timeoutMin}m)`);
    events.emit({
      type: "phase_started",
      storyId: story.id,
      phase: "worker",
      iteration: iter,
      totalIterations: maxIter,
      detail: `${featureBranch}, timeout ${timeoutMin}m`,
    });
    const w = await runPi(
      workerPrompt(story, "", story.test_command ?? testCommand, feedback),
      storyCwd,
      sprint.worker_model,
      (line) => {
        if (line.trim()) {
          console.log(`  pi> ${line}`);
          events.emit({ type: "pi_stdout", storyId: story.id, phase: "worker", line, iteration: iter });
        }
      },
      { timeoutMs },
      (line) => {
        if (line.trim()) events.emit({ type: "pi_stderr", storyId: story.id, phase: "worker", line, iteration: iter });
      },
    );
    const workerIterStdout = paths.artifact(story.id, `worker.iter${iter}.stdout.log`);
    const workerIterStderr = paths.artifact(story.id, `worker.iter${iter}.stderr.log`);
    const workerStdout = paths.artifact(story.id, ARTIFACTS.workerStdout);
    const workerStderr = paths.artifact(story.id, ARTIFACTS.workerStderr);
    writeArtifact(workerIterStdout, w.stdout);
    emitArtifact(story.id, `worker.iter${iter}.stdout.log`, workerIterStdout);
    writeArtifact(workerIterStderr, w.stderr);
    emitArtifact(story.id, `worker.iter${iter}.stderr.log`, workerIterStderr);
    writeArtifact(workerStdout, w.stdout);
    emitArtifact(story.id, ARTIFACTS.workerStdout, workerStdout);
    writeArtifact(workerStderr, w.stderr);
    emitArtifact(story.id, ARTIFACTS.workerStderr, workerStderr);

    if (w.exitCode !== 0) {
      const reason = w.timedOut ? `worker timed out after ${timeoutMin}m (iter ${iter})` : `worker exit ${w.exitCode} (iter ${iter})`;
      events.emit({ type: "phase_finished", storyId: story.id, phase: "worker", ok: false, detail: reason, iteration: iter });
      if (retry.worker && iter < maxIter) {
        feedback = accumulateFeedback(feedback, workerCrashFeedback(reason, w.stderr), iter);
        noteRetry("worker", iter);
        continue;
      }
      return endStory(retry.worker ? "needs_human" : "failed", `${reason}\n${w.stderr.slice(0, 500)}`);
    }

    const commitsSoFar = commitsOnBranch(featureBranch, stagingBranch, storyCwd);
    if (commitsSoFar.length === 0) {
      const reason = `worker exited but made no commits (iter ${iter})`;
      events.emit({ type: "phase_finished", storyId: story.id, phase: "worker", ok: false, detail: reason, iteration: iter });
      if (retry.worker && iter < maxIter) {
        feedback = accumulateFeedback(feedback, workerCrashFeedback(reason, w.stderr), iter);
        noteRetry("worker", iter);
        continue;
      }
      return endStory(retry.worker ? "needs_human" : "failed", reason);
    }

    // worker-commit guard: assert ONLY the feature branch advanced. Any other
    // local ref moving means the worker escaped its sandbox (merged/reset/etc.).
    const headsAfter = localBranchHeads(storyCwd);
    const movedOther = Object.entries(headsAfter).find(
      ([b, sha]) => b !== featureBranch && branchHeadsBeforeWorker[b] !== undefined && branchHeadsBeforeWorker[b] !== sha,
    );
    if (movedOther) {
      const [branch, sha] = movedOther;
      const reason = `worker mutated a branch it must not touch: ${branch} moved ${branchHeadsBeforeWorker[branch]?.slice(0, 8)} → ${sha.slice(0, 8)} (iter ${iter})`;
      events.emit({ type: "phase_finished", storyId: story.id, phase: "worker", ok: false, detail: reason, iteration: iter });
      // This is an integrity violation, not a code-quality miss — park for a human.
      return endStory("needs_human", reason);
    }

    ss.commits = commitsSoFar;
    workerDiff = diffBetween(stagingBranch, featureBranch, storyCwd);
    const workerDiffPath = paths.artifact(story.id, ARTIFACTS.workerDiff);
    writeArtifact(workerDiffPath, workerDiff);
    emitArtifact(story.id, ARTIFACTS.workerDiff, workerDiffPath);
    events.emit({ type: "phase_finished", storyId: story.id, phase: "worker", ok: true, detail: `${commitsSoFar.length} commit(s)`, iteration: iter });
    persist();

    // 2. Reviewer gate (optional). On request_changes: feed back and retry, else park/fail.
    if (sprint.enable_reviewer) {
      log(`reviewer: pass ${iter}/${maxIter}`);
      events.emit({ type: "phase_started", storyId: story.id, phase: "reviewer", iteration: iter, totalIterations: maxIter });
      const review = await runReview(story, workerDiff, storyCwd, sprint.reviewer_model, lastReview);
      const reviewerIterPath = paths.artifact(story.id, `reviewer.iter${iter}.json`);
      const reviewerJudgementPath = paths.artifact(story.id, ARTIFACTS.reviewerJudgement);
      writeJsonArtifact(reviewerIterPath, review);
      emitArtifact(story.id, `reviewer.iter${iter}.json`, reviewerIterPath);
      writeJsonArtifact(reviewerJudgementPath, review);
      emitArtifact(story.id, ARTIFACTS.reviewerJudgement, reviewerJudgementPath);
      if (review.diff_truncated) {
        events.emit({ type: "diff_truncated", storyId: story.id, phase: "reviewer", omitted: workerDiff.length - 80000, cap: 80000 });
      }
      if (review.degraded) {
        // FAIL CLOSED: the reviewer gate could not run — do NOT treat as approve.
        // Park as needs_human with an explicit degraded-gate event so a human
        // sees the gate was bypassed by infrastructure, not by a real verdict.
        log(`PARK  ${story.id}: reviewer gate degraded (${review.degraded_reason})`);
        events.emit({ type: "degraded_gate", storyId: story.id, gate: "reviewer", reason: review.degraded_reason ?? "unknown" });
        events.emit({ type: "phase_finished", storyId: story.id, phase: "reviewer", ok: false, detail: `degraded: ${review.degraded_reason}`, iteration: iter });
        return endStory("needs_human", `reviewer gate degraded (fail-closed): ${review.degraded_reason}`);
      }
      const mustFix = review.issues.filter((i) => i.severity === "must_fix");
      log(`reviewer: ${review.verdict} (${mustFix.length} must_fix, ${review.issues.length - mustFix.length} nice_to_have)`);
      events.emit({
        type: "phase_finished",
        storyId: story.id,
        phase: "reviewer",
        ok: review.verdict === "approve",
        detail: `${review.verdict} (${mustFix.length} must_fix)`,
        iteration: iter,
      });
      for (const m of mustFix) log(`        ${m.category} ${m.file}${m.line ? `:${m.line}` : ""} — ${m.problem}`);
      lastReview = review;
      if (review.verdict !== "approve") {
        if (retry.reviewer && iter < maxIter) {
          if (stuckOnSameFailure("reviewer", iter, mustFix.map((m) => `${m.file}:${m.line} ${m.problem}`).join("\n"))) return;
          feedback = accumulateFeedback(feedback, reviewerFeedbackForWorker(review), iter);
          noteRetry("reviewer", iter);
          continue;
        }
        return endStory(
          retry.reviewer ? "needs_human" : "failed",
          `reviewer still requesting changes after ${iter} iteration(s); ${mustFix.length} must_fix unresolved`,
        );
      }
    }

    // 3. Verify (test command)
    log(`verify: ${story.test_command ?? testCommand} (timeout ${testTimeoutMin}m)`);
    events.emit({ type: "phase_started", storyId: story.id, phase: "verify", detail: `${story.test_command ?? testCommand}, timeout ${testTimeoutMin}m` });
    const t = runTestCommand(story.test_command ?? testCommand, storyCwd, testTimeoutMs);
    const testOutputPath = paths.artifact(story.id, ARTIFACTS.testCommandOutput);
    writeArtifact(testOutputPath, t.output);
    emitArtifact(story.id, ARTIFACTS.testCommandOutput, testOutputPath);
    events.emit({ type: "test_output", storyId: story.id, phase: "verify", ok: t.ok, tail: t.output.split("\n").slice(-80).join("\n") });
    events.emit({ type: "phase_finished", storyId: story.id, phase: "verify", ok: t.ok, detail: t.ok ? "tests passed" : "tests failed" });
    if (!t.ok) {
      if (t.timedOut) {
        return endStory("needs_human", `test_command timed out after ${testTimeoutMin}m:\n${t.output.slice(-1500)}`);
      }
      if (retry.test && iter < maxIter) {
        if (stuckOnSameFailure("verify", iter, t.output)) return;
        feedback = accumulateFeedback(feedback, testFailureFeedback(t.output), iter);
        noteRetry("verify", iter);
        continue;
      }
      return endStory(retry.test ? "needs_human" : "failed", `test_command failed after ${iter} iteration(s):\n${t.output.slice(-1500)}`);
    }

    // 4. Generate qa-script with diff visibility, then run it
    log(`qa-script: drafting (diff-aware)`);
    events.emit({ type: "phase_started", storyId: story.id, phase: "qa-script", detail: "drafting acceptance script" });
    const qa = await runPi(
      qaScriptPrompt(story, workerDiff),
      storyCwd,
      sprint.qa_model,
      (line) => {
        if (line.trim()) events.emit({ type: "pi_stdout", storyId: story.id, phase: "qa-script", line });
      },
      { timeoutMs: DEFAULT_QA_TIMEOUT_MIN * 60 * 1000 },
      (line) => {
        if (line.trim()) events.emit({ type: "pi_stderr", storyId: story.id, phase: "qa-script", line });
      },
    );
    if (qa.exitCode !== 0 || !qa.stdout.trim()) {
      const reason = qa.timedOut
        ? `qa-script author timed out after ${DEFAULT_QA_TIMEOUT_MIN}m`
        : `qa-script author failed (exit ${qa.exitCode})\n${qa.stderr.slice(0, 500)}`;
      events.emit({ type: "phase_finished", storyId: story.id, phase: "qa-script", ok: false, detail: reason });
      // qa-author is harness INFRASTRUCTURE, not the worker's code. The worker
      // already produced a reviewed, test-passing commit — don't discard it as a
      // hard failure. Park for a human to re-run the gate (qa-author-fail-hard-not-park).
      return endStory("needs_human", `qa-author gate could not run (work is salvageable): ${reason}`);
    }
    writeFileSync(acceptPath, qa.stdout);
    chmodSync(acceptPath, 0o755);
    const qaScriptPath = paths.artifact(story.id, ARTIFACTS.qaScript);
    writeArtifact(qaScriptPath, qa.stdout);
    emitArtifact(story.id, ARTIFACTS.qaScript, qaScriptPath);
    events.emit({ type: "phase_finished", storyId: story.id, phase: "qa-script", ok: true, detail: acceptPath });

    log(`accept: ${acceptPath} (sandboxed)`);
    events.emit({ type: "phase_started", storyId: story.id, phase: "acceptance", detail: acceptPath });
    // The acceptance script is LLM-authored from an untrusted story body + diff
    // (qa-script-arbitrary-exec). Run it through the content gate + isolation
    // sandbox instead of chmod+exec on the host with full env.
    const sandboxResult = runSandboxed(qa.stdout, {
      scriptPath: acceptPath,
      cwd: storyCwd,
      timeoutMs: DEFAULT_QA_TIMEOUT_MIN * 60 * 1000,
    });
    if (sandboxResult.rejected) {
      // A dangerous construct (rm -rf / push / network) was found — never executed.
      // This is a prompt-injection / untrusted-output event: park for a human.
      events.emit({ type: "sandbox_rejected", storyId: story.id, reason: sandboxResult.rejectReason ?? "content gate" });
      events.emit({ type: "phase_finished", storyId: story.id, phase: "acceptance", ok: false, detail: `rejected: ${sandboxResult.rejectReason}` });
      writeArtifact(paths.artifact(story.id, ARTIFACTS.qaScriptOutput), sandboxResult.output);
      return endStory("needs_human", `acceptance script rejected by content gate: ${sandboxResult.rejectReason}`);
    }
    log(`accept: ran in ${sandboxResult.mode} sandbox`);
    const a = { ok: sandboxResult.ok, output: sandboxResult.output };
    const qaOutputPath = paths.artifact(story.id, ARTIFACTS.qaScriptOutput);
    writeArtifact(qaOutputPath, a.output);
    emitArtifact(story.id, ARTIFACTS.qaScriptOutput, qaOutputPath);
    events.emit({ type: "test_output", storyId: story.id, phase: "acceptance", ok: a.ok, tail: a.output.split("\n").slice(-80).join("\n") });
    events.emit({ type: "phase_finished", storyId: story.id, phase: "acceptance", ok: a.ok, detail: a.ok ? "acceptance passed" : "acceptance failed" });
    if (!a.ok) {
      if (sprint.acceptance_advisory) {
        // Advisory: per-story code-level acceptance is the wrong altitude (see
        // dua-factory docs/QA-AUTHOR.md). Warn and proceed — like scenario-judge —
        // rather than feeding back or parking. Real behavioural acceptance lives at
        // the feature boundary (B2). verify + reviewer remain the blocking gates.
        log(`WARN  ${story.id}: acceptance failed (advisory) — proceeding`);
      } else if (retry.acceptance && iter < maxIter) {
        if (stuckOnSameFailure("acceptance", iter, a.output)) return;
        feedback = accumulateFeedback(feedback, acceptanceFailureFeedback(a.output), iter);
        noteRetry("acceptance", iter);
        continue;
      } else {
        return endStory(retry.acceptance ? "needs_human" : "failed", `acceptance failed after ${iter} iteration(s):\n${a.output.slice(-1500)}`);
      }
    }

    // 5. Scenario-judge (lenient: warn but don't block)
    const scenarios = scenariosForStory(sprint.feature_path, story.id, story.feature_story_id);
    if (scenarios.length > 0) {
      log(`judge: ${scenarios.length} scenarios via 3-judge majority`);
      events.emit({ type: "phase_started", storyId: story.id, phase: "scenario-judge", detail: `${scenarios.length} scenarios` });
      const diff = diffBetween(stagingBranch, featureBranch, storyCwd);
      const judgement = await judgeScenarios(story, scenarios, diff, t.output, storyCwd, sprint.judge_model);
      const scenarioJudgementPath = paths.artifact(story.id, ARTIFACTS.scenarioJudgement);
      writeJsonArtifact(scenarioJudgementPath, judgement);
      emitArtifact(story.id, ARTIFACTS.scenarioJudgement, scenarioJudgementPath);
      if (judgement.diff_truncated) {
        events.emit({ type: "diff_truncated", storyId: story.id, phase: "scenario-judge", omitted: diff.length - 60000, cap: 60000 });
      }
      if (judgement.gate_errored) {
        // FAIL CLOSED: every judge crashed/timed out, so the panel produced no
        // signal. Don't read the empty consensus as a lenient pass — park with a
        // degraded-gate event (reviewer-judge-fail-open).
        log(`PARK  ${story.id}: scenario-judge panel all-errored — gate_errored`);
        events.emit({ type: "degraded_gate", storyId: story.id, gate: "scenario-judge", reason: "all judges crashed/timed out" });
        events.emit({ type: "phase_finished", storyId: story.id, phase: "scenario-judge", ok: false, detail: "gate_errored" });
        return endStory("needs_human", "scenario-judge gate errored (all judges failed) — fail-closed park");
      }
      const failed = judgement.consensus.filter((c) => c.verdict === "fail");
      const inconclusive = judgement.consensus.filter((c) => c.verdict === "inconclusive");
      if (failed.length > 0) {
        log(`WARN  ${story.id}: scenario-judge fail (${failed.length}/${scenarios.length}) — proceeding (lenient)`);
        for (const f of failed) log(`        ${f.id}: ${f.gaps[0] ?? "no gap reported"}`);
      } else if (inconclusive.length > 0) {
        log(`WARN  ${story.id}: scenario-judge inconclusive (${inconclusive.length}/${scenarios.length})`);
      } else {
        log(`PASS  ${story.id}: scenarios pass`);
      }
      events.emit({ type: "phase_finished", storyId: story.id, phase: "scenario-judge", ok: judgement.overall !== "fail", detail: judgement.overall });
    } else if (sprint.feature_path) {
      log(`judge: no scenarios found for ${story.id} in ${sprint.feature_path}`);
    }

    // 6. Merge feature → staging — story is green and reviewed.
    // A merge conflict against staging is an EXPECTED per-story terminal state
    // (overlapping edits with an earlier merged story), never sprint-fatal. The
    // previous bare mergeNoFf threw to process.exit(1) and left staging in a
    // MERGING state that bricked the next resume's clean-tree preflight
    // (merge-conflict-unhandled). tryMergeNoFf aborts on conflict so the tree is
    // clean, and we park the story instead of crashing the sprint.
    events.emit({ type: "phase_started", storyId: story.id, phase: "merge", detail: `${featureBranch} → ${stagingBranch}` });
    const preMerge = headSha(storyCwd, stagingBranch);
    const merge = tryMergeNoFf(featureBranch, stagingBranch, `merge: ${story.id} ${story.title}`, storyCwd);
    if (!merge.ok) {
      if (merge.conflict) {
        events.emit({ type: "git", action: "merge_abort", branch: stagingBranch });
        events.emit({ type: "phase_finished", storyId: story.id, phase: "merge", ok: false, detail: "merge conflict (aborted)" });
        return endStory("needs_human", `merge conflict against ${stagingBranch}: ${merge.detail.split("\n").slice(0, 6).join("\n")}`);
      }
      events.emit({ type: "phase_finished", storyId: story.id, phase: "merge", ok: false, detail: "merge error" });
      return endStory("needs_human", `merge failed against ${stagingBranch}: ${merge.detail.split("\n").slice(0, 6).join("\n")}`);
    }
    events.emit({ type: "git", action: "merge", fromBranch: featureBranch, intoBranch: stagingBranch, message: `merge: ${story.id} ${story.title}` });

    // Post-merge verification (acceptance-validates-premerge-no-postmerge-verify):
    // each story was green in isolation against the staging state it BRANCHED
    // from, but stories merge sequentially into shared staging. A clean textual
    // merge can still be a semantic break (story B never saw story A's change).
    // Re-run the test command on the merged staging; on failure revert the merge
    // (reset to ORIG_HEAD) and park so staging never ends a sprint red while the
    // story reads 'merged'. Skipped only when explicitly opted out.
    if (sprint.skip_postmerge_verify) {
      log(`skip post-merge verify (skip_postmerge_verify)`);
    } else {
      log(`post-merge verify on ${stagingBranch}: ${story.test_command ?? testCommand} (timeout ${testTimeoutMin}m)`);
      const pv = runTestCommand(story.test_command ?? testCommand, storyCwd, testTimeoutMs);
      writeArtifact(paths.artifact(story.id, "postmerge-verify.output.log"), pv.output);
      if (!pv.ok) {
        const reverted = resetHard(preMerge, storyCwd);
        const restored = reverted.ok && headSha(storyCwd) === preMerge;
        events.emit({ type: "postmerge_verify", storyId: story.id, ok: false, reverted: restored });
        if (restored) events.emit({ type: "git", action: "merge_revert", branch: stagingBranch });
        events.emit({ type: "phase_finished", storyId: story.id, phase: "merge", ok: false, detail: "post-merge verify failed (reverted)" });
        return endStory(
          "needs_human",
          `post-merge verify ${pv.timedOut ? `timed out after ${testTimeoutMin}m` : `failed`} on ${stagingBranch}${restored ? " (merge reverted)" : " (REVERT FAILED — manual fix needed)"}:\n${pv.output.slice(-1500)}`,
        );
      }
      events.emit({ type: "postmerge_verify", storyId: story.id, ok: true, reverted: false });
    }

    events.emit({ type: "phase_finished", storyId: story.id, phase: "merge", ok: true, detail: stagingBranch });
    ss.status = "merged";
    ss.ended_at = new Date().toISOString();
    log(`PASS  ${story.id} merged → ${stagingBranch} (iter ${iter}/${maxIter})`);
    events.emit({ type: "story_finished", storyId: story.id, status: ss.status });
    persist();
    return;
  }
};

export interface RunSprintOptions {
  repoCwd: string;
  /** When set, this run is scoped to a single story (its deps already cleared by the caller). */
  onlyStory?: string;
  /** Full story universe for state init. Defaults to sprint.stories; pass the unfiltered list for --story runs. */
  allStories?: Story[];
  tmuxUi?: boolean;
  /** Original sprint file path, recorded in the run_started event. Optional for board/daemon callers. */
  sprintPath?: string;
}

/**
 * Run a whole sprint: derive per-run context, init/resume state, then run each
 * story (in dependency order) via runStory, and tear down. Returns the final
 * SprintState. Pure callable — does not read argv or call process.exit — so the
 * board watcher and daemon can drive it directly.
 */
export const runSprint = async (sprint: Sprint, opts: RunSprintOptions): Promise<SprintState> => {
  const { repoCwd, onlyStory, tmuxUi = false } = opts;
  const baseBranch = sprint.base_branch ?? "main";
  const runId = sprint.staging_branch ? branchRunId(sprint.staging_branch) : `${Date.now()}`;
  const stagingBranch = sprint.staging_branch ?? `pi-team-lean/${runId}/staging`;
  const testCommand = sprint.test_command ?? "npm test";
  const stateDir = join(repoCwd, ".pi-team-lean");
  const acceptDir = join(stateDir, "acceptance");
  const paths = runPaths(repoCwd, runId);
  const statePath = paths.state;
  const events = createEventWriter(paths.events);
  const emitArtifact = (storyId: string, name: string, path: string): void =>
    events.emit({ type: "artifact_written", storyId, name, path });

  const storyCwds = Array.from(new Set(sprint.stories.map((story) => resolveStoryCwd(repoCwd, story))));
  if (storyCwds.includes(repoCwd)) ensureCleanTree(repoCwd);
  for (const storyCwd of storyCwds) {
    if (storyCwd !== repoCwd) ensureCleanTree(storyCwd);
  }
  mkdirSync(acceptDir, { recursive: true });
  mkdirSync(paths.root, { recursive: true });
  events.emit({
    type: "run_started",
    runId,
    cwd: repoCwd,
    sprintPath: opts.sprintPath ? resolve(opts.sprintPath) : "",
    baseBranch,
    stagingBranch,
    storyCount: sprint.stories.length,
  });
  log(`Repo: ${repoCwd}`);
  events.emit({ type: "log", message: `Repo: ${repoCwd}` });
  log(`Base: ${baseBranch}  Staging: ${stagingBranch}`);
  events.emit({ type: "log", message: `Base: ${baseBranch}  Staging: ${stagingBranch}` });

  const stateUniverse = opts.allStories ?? sprint.stories;
  // State is strictly per-run (runs/<runId>/sprint-state.json). NO shared-root
  // fallback: a previous run's state must never seed a different run (that caused
  // cross-card contamination → false needs_human parks). runId is deterministic
  // (branchRunId(staging_branch)), so a resume always finds its own per-run file.
  const state: SprintState = mergeSprintState(
    readSprintState(statePath) ?? initialSprintState(stateUniverse, baseBranch, stagingBranch),
    stateUniverse,
  );
  const persist = (): void => {
    // Atomic state write (write-temp + rename): a crash mid-write must never
    // leave sprint-state.json truncated, or a resume reads garbage JSON.
    writeFileAtomic(statePath, JSON.stringify(state, null, 2));
    events.emit({ type: "state_written", path: statePath });
    for (const [sid, ss] of Object.entries(state.stories)) {
      if (ss.status === "pending") continue;
      writeJsonArtifact(paths.artifact(sid, ARTIFACTS.meta), { id: sid, ...ss });
    }
  };
  persist();
  if (tmuxUi) openTmuxWatcher(repoCwd, runId);

  const ctx: RunContext = {
    sprint,
    repoCwd,
    baseBranch,
    stagingBranch,
    runId,
    testCommand,
    acceptDir,
    paths,
    events,
    state,
    persist,
    emitArtifact,
  };

  const ordered = topoSort(sprint.stories);
  for (const story of ordered) {
    await runStory(story, ctx);
  }

  state.ended_at = new Date().toISOString();
  persist();
  for (const storyCwd of storyCwds) {
    if (branchExists(stagingBranch, storyCwd)) {
      checkout(stagingBranch, storyCwd);
      events.emit({ type: "git", action: "checkout", branch: stagingBranch });
    }
  }

  const summary = Object.entries(state.stories).map(([id, s]) => `  ${s.status.padEnd(10)} ${id}`);
  events.emit({
    type: "run_finished",
    runId,
    stagingBranch,
    summary: Object.entries(state.stories).map(([id, s]) => ({ id, status: s.status })),
  });
  log(`\nSprint complete on ${stagingBranch}\n${summary.join("\n")}`);
  log(`State: ${statePath}`);
  events.emit({ type: "log", message: `State: ${statePath}` });
  return state;
};

const main = async (): Promise<void> => {
  if (process.argv[2] === "check") {
    process.exit(cliPreflight(process.argv.slice(3)));
  }
  if (process.argv[2] === "watch" || process.argv[2] === "tui") {
    const code = runWatch(process.argv.slice(3));
    if (code !== 0) process.exit(code);
    return;
  }
  const sprintPath = process.argv[2];
  if (!sprintPath) {
    console.error("Usage: pi-team-lean <sprint.json> [--cwd <repo>]");
    console.error("       pi-team-lean check <repo> [--sprint <path>]");
    console.error("       pi-team-lean <sprint.json> [--cwd <repo>] [--tmux-ui]");
    console.error("       pi-team-lean tui|watch [--cwd <repo>] [--run <runId>]");
    process.exit(2);
  }
  const cwdFlagIdx = process.argv.indexOf("--cwd");
  const repoCwd = cwdFlagIdx > 0 ? resolve(process.argv[cwdFlagIdx + 1]!) : process.cwd();
  const storyFlagIdx = process.argv.indexOf("--story");
  const onlyStory = storyFlagIdx > 0 ? process.argv[storyFlagIdx + 1] : undefined;
  const explicitTmuxUi = process.argv.includes("--tmux-ui");
  const envTmuxUi = process.env.PI_TEAM_LEAN_TMUX_UI === "1";
  const tmuxUi = explicitTmuxUi || (envTmuxUi && !onlyStory);

  const sprint: Sprint = JSON.parse(readFileSync(sprintPath, "utf8"));
  const allSprintStories = [...sprint.stories];
  if (onlyStory) {
    const filtered = sprint.stories.filter((s) => s.id === onlyStory);
    if (filtered.length === 0) {
      console.error(`[pi-team-lean] --story ${onlyStory} not found in sprint`);
      process.exit(2);
    }
    sprint.stories = [{ ...filtered[0]!, depends_on: [] }];
    console.log(`[pi-team-lean] Filtered to single story: ${onlyStory} (dependencies cleared)`);
  }
  if (envTmuxUi && onlyStory && !explicitTmuxUi) {
    log("Skipping auto tmux watcher for --story run; existing sprint dashboard should keep showing the full run");
  }

  await runSprint(sprint, {
    repoCwd,
    onlyStory,
    allStories: onlyStory ? allSprintStories : undefined,
    tmuxUi,
    sprintPath,
  });
};

// Run the CLI as a side-effect of import (the bin entry does `import dist/index.js`).
// Skip under vitest so unit tests can import runStory/runSprint/helpers without
// triggering an argv-driven sprint run.
if (!process.env.VITEST) {
  main().catch((e: Error) => {
    console.error(`[pi-team-lean] FATAL: ${e.message}`);
    process.exit(1);
  });
}
