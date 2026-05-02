import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runPi } from "./pi.js";
import type { Story } from "./types.js";

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
${diff.slice(0, 80000)}
\`\`\`
${feedbackHistory ? `\n# Previous review (this is iteration N+1)\n\n${feedbackHistory}\n` : ""}
Return the JSON object now.`;

const parseReview = (raw: string): ReviewResult => {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("no JSON object found");
    const obj = JSON.parse(raw.slice(start, end + 1));
    const verdict = obj.verdict === "request_changes" ? "request_changes" : "approve";
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
    return { verdict, issues, summary: String(obj.summary ?? ""), raw };
  } catch (e: unknown) {
    return {
      verdict: "approve",
      issues: [],
      summary: "",
      raw,
      parse_error: (e as Error).message,
    };
  }
};

export const runReview = async (
  story: Story,
  diff: string,
  cwd: string,
  model: string | undefined,
  previousReview?: ReviewResult,
): Promise<ReviewResult> => {
  const conventions = loadConventions(cwd);
  const feedbackHistory = previousReview
    ? `Previous must_fix issues you flagged:\n${previousReview.issues
        .filter((i) => i.severity === "must_fix")
        .map((i) => `- ${i.file}:${i.line ?? "?"} (${i.category}) ${i.problem}`)
        .join("\n")}\n\nCheck if these are now resolved in the current diff. Re-flag only if still present.`
    : "";
  const r = await runPi(reviewerPrompt(story, diff, conventions, feedbackHistory), cwd, model);
  if (r.exitCode !== 0) {
    return {
      verdict: "approve",
      issues: [],
      summary: "",
      raw: r.stderr,
      parse_error: `exit ${r.exitCode}`,
    };
  }
  return parseReview(r.stdout);
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
