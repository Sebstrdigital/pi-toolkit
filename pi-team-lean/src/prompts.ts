import type { Story } from "./types.js";

export const workerPrompt = (
  story: Story,
  scopeHint: string,
  testCommand: string,
  reviewFeedback: string = "",
): string => `You are implementing a single user story end-to-end on the current git branch. Make the code changes, run the tests, commit, and stop.

# Story

**Title:** ${story.title}

**Body:**
${story.body}

# Constraints

- Project conventions live in \`./CLAUDE.md\` or \`./.pi/AGENTS.md\` if present — read first.
- Scope hint: ${scopeHint || "(none — touch what the story requires, nothing else)"}
- Run \`${testCommand}\` after your changes. If it fails, fix and re-run until it passes (max 3 attempts).
- Commit with: \`git add -A && git commit -m "feat: <story-id> <short summary>"\`
- Do NOT create branches, merge, push, or run other git ops beyond add/commit.
${reviewFeedback ? `\n${reviewFeedback}\n` : ""}
# Done

When tests pass and you've committed, stop. The harness will verify and merge.`;
