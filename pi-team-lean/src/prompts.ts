import type { Story } from "./types.js";

export const qaAuthorPrompt = (story: Story): string => `You are authoring acceptance checks for a user story. Output a single bash script that exits 0 only when the story is correctly implemented.

# Story

**Title:** ${story.title}

**Body:**
${story.body}

# Output rules

1. Output ONLY the bash script. No prose, no markdown fences, no explanation.
2. Start with \`#!/usr/bin/env bash\` and \`set -u\`.
3. Use environment variable \`BASE_URL\` (default http://localhost:3000) if HTTP is needed.
4. Each assertion must be independent and idempotent.
5. Print \`PASS <name>\` or \`FAIL <name>\` for each check.
6. Track failures in a counter and \`exit $FAIL\` at the end.
7. The script will run AFTER the implementation is committed and AFTER the project's test_command passes. Assume the application code exists.
8. If the story requires a running server, the harness has started it on $BASE_URL before invoking your script. Do not start servers yourself.

Begin now.`;

export const workerPrompt = (story: Story, scopeHint: string, testCommand: string): string => `You are implementing a single user story end-to-end on the current git branch. Make the code changes, run the tests, commit, and stop.

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

# Done

When tests pass and you've committed, stop. The harness will verify and merge.`;
