import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runPi, DEFAULT_GATE_TIMEOUT_MS } from "./pi.js";
import { truncateForPrompt } from "./truncate.js";
import type { Story } from "./types.js";

const REVIEW_DIFF_CAP = 80000;

export interface ReviewIssue {
  severity: "must_fix" | "nice_to_have";
  category: string;
  file: string;
  line: number | null;
  problem: string;
  suggested_fix: string;
}

export interface ReviewResult {
  verdict: "approve" | "request_changes";
  issues: ReviewIssue[];
  summary: string;
  raw?: string;
  parse_error?: string;
  /**
   * True when this verdict came from a gate-INFRASTRUCTURE failure (crash,
   * timeout, unparseable output) rather than a genuine review. The gate fails
   * CLOSED (verdict forced to request_changes) and the caller surfaces a
   * degraded-gate event instead of silently treating it as a real verdict.
   */
  degraded?: boolean;
  /** Reason the gate was degraded (timeout / exit N / parse_error). */
  degraded_reason?: string;
  /** True when the reviewed diff was truncated to fit the prompt budget. */
  diff_truncated?: boolean;
}

const skillRoot = (): string => {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "reviewer");
};

let cachedSkill: string | null = null;

const loadSkill = (): string => {
  if (cachedSkill) return cachedSkill;
  const root = skillRoot();
  const parts = ["reviewer.md", "patterns.md", "scope.md"]
    .map((f) => readFileSync(join(root, f), "utf8"))
    .join("\n\n---\n\n");
  cachedSkill = parts;
  return parts;
};

const conventionFiles = [
  "CLAUDE.md",
  ".pi/AGENTS.md",
  ".editorconfig",
  ".eslintrc.json",
  ".eslintrc.cjs",
  ".prettierrc",
  ".prettierrc.json",
  ".swiftformat",
  ".swift-format",
];

const loadConventions = (cwd: string): string => {
  const found: string[] = [];
  for (const f of conventionFiles) {
    const p = join(cwd, f);
    if (existsSync(p)) {
      try {
        const c = readFileSync(p, "utf8");
        found.push(`### ${f}\n\n${c.slice(0, 4000)}`);
      } catch {
        /* ignore */
      }
    }
  }
  return found.length > 0 ? found.join("\n\n") : "(no project conventions documented)";
};

const reviewerPrompt = (
  story: Story,
  diff: string,
  conventions: string,
  feedbackHistory: string,
): string => `${loadSkill()}

# Project conventions

${conventions}

# Story being implemented

**Title:** ${story.title}

**Body:**
${story.body}

# Worker diff to review

\`\`\`diff
${truncateForPrompt(diff, REVIEW_DIFF_CAP).text}
\`\`\`
${feedbackHistory ? `\n# Previous review (this is iteration N+1)\n\n${feedbackHistory}\n` : ""}
Return the JSON object now.`;

export const parseReview = (raw: string): ReviewResult => {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("no JSON object found");
    const obj = JSON.parse(raw.slice(start, end + 1));
    const verdict = obj.verdict === "approve" ? "approve" : "request_changes";
    const issues: ReviewIssue[] = Array.isArray(obj.issues)
      ? obj.issues.map((i: Record<string, unknown>) => ({
          severity: i.severity === "must_fix" ? "must_fix" : "nice_to_have",
          category: String(i.category ?? "design"),
          file: String(i.file ?? ""),
          line: typeof i.line === "number" ? i.line : null,
          problem: String(i.problem ?? ""),
          suggested_fix: String(i.suggested_fix ?? ""),
        }))
      : [];
    const ambiguous = obj.verdict !== "approve" && obj.verdict !== "request_changes";
    return {
      verdict,
      issues,
      summary: String(obj.summary ?? ""),
      raw,
      ...(ambiguous
        ? {
            degraded: true,
            degraded_reason: `ambiguous verdict: ${String(obj.verdict ?? "missing")}`,
          }
        : {}),
    };
  } catch (e: unknown) {
    // FAIL CLOSED: unparseable reviewer output must not be read as an approve.
    // The reviewer is the strongest safety gate; a non-JSON response is an
    // infrastructure failure, so force request_changes and mark it degraded so
    // the caller surfaces it (reviewer-judge-fail-open).
    return {
      verdict: "request_changes",
      issues: [],
      summary: "",
      raw,
      parse_error: (e as Error).message,
      degraded: true,
      degraded_reason: `parse_error: ${(e as Error).message}`,
    };
  }
};

export const runReview = async (
  story: Story,
  diff: string,
  cwd: string,
  model: string | undefined,
  previousReview?: ReviewResult,
  timeoutMs: number = DEFAULT_GATE_TIMEOUT_MS,
): Promise<ReviewResult> => {
  const conventions = loadConventions(cwd);
  const feedbackHistory = previousReview
    ? `Previous must_fix issues you flagged:\n${previousReview.issues
        .filter((i) => i.severity === "must_fix")
        .map((i) => `- ${i.file}:${i.line ?? "?"} (${i.category}) ${i.problem}`)
        .join("\n")}\n\nCheck if these are now resolved in the current diff. Re-flag only if still present.`
    : "";
  const diffTruncated = diff.length > REVIEW_DIFF_CAP;
  const r = await runPi(reviewerPrompt(story, diff, conventions, feedbackHistory), cwd, model, undefined, { timeoutMs });
  if (r.exitCode !== 0) {
    // FAIL CLOSED on crash/timeout: a non-zero reviewer exit is a degraded gate,
    // not an approval. Force request_changes so the story cannot silently merge.
    const reason = r.timedOut ? `reviewer timed out after ${Math.round(timeoutMs / 60000)}m` : `exit ${r.exitCode}`;
    return {
      verdict: "request_changes",
      issues: [],
      summary: "",
      raw: r.stderr,
      parse_error: reason,
      degraded: true,
      degraded_reason: reason,
      diff_truncated: diffTruncated,
    };
  }
  return { ...parseReview(r.stdout), diff_truncated: diffTruncated };
};

export const reviewerFeedbackForWorker = (review: ReviewResult): string => {
  const must = review.issues.filter((i) => i.severity === "must_fix");
  if (must.length === 0) return "";
  return `# Code review feedback

The reviewer flagged the following must-fix issues with your previous commit. Address each, then commit again.

${must
  .map(
    (i, idx) => `## Issue ${idx + 1} — ${i.category}

- File: ${i.file}${i.line ? `:${i.line}` : ""}
- Problem: ${i.problem}
- Suggested fix: ${i.suggested_fix}`,
  )
  .join("\n\n")}

Address all must_fix issues. Do not refactor anything outside the diff. Commit with: \`git add -A && git commit -m "fix: address review feedback"\``;
};
