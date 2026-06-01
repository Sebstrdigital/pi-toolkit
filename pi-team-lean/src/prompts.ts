import { truncateForPrompt } from "./truncate.js";
import type { Story } from "./types.js";

const QA_DIFF_CAP = 60000;

export const qaScriptPrompt = (story: Story, diff: string): string => `You are authoring acceptance checks for a user story that has just been implemented. Output a single bash script that exits 0 only when the implementation correctly satisfies the story.

# Story

**Title:** ${story.title}

**Body:**
${story.body}

# Worker diff (what was actually implemented)

\`\`\`diff
${truncateForPrompt(diff, QA_DIFF_CAP).text}
\`\`\`

# Output rules

1. Output ONLY the bash script. No prose, no markdown fences, no explanation.
2. Start with \`#!/usr/bin/env bash\` and \`set -u\`.
3. Each assertion must be independent and idempotent.
4. Print \`PASS <name>\` or \`FAIL <name>\` for each check.
5. Track failures in a counter and \`exit $FAIL\` at the end.
6. The project's test_command has already passed before this script runs. Assume the application builds and tests pass.

# Hard rules — what NOT to do

- DO NOT assert literal API call strings (e.g. "activate(ignoringOtherApps: true)" — defensible API choices may differ).
- DO NOT assert literal test method names or substrings of test names ("ordering", "idempotent", etc.) — name them what you want; behavior is judged elsewhere.
- DO NOT parse function bodies and assert call ordering or that one identifier appears before another — refactors break this.
- DO NOT require specific error messages or log strings unless the story body pins them.
- DO NOT regex over identifier names — names change.

# Hard rules — compiling scratch checks (avoid harness false-negatives)

If your check compiles a throwaway source file (common for typed languages), the compiler invocation must not fail for reasons unrelated to the code under test:

- PREFER running the project's own existing test/build/typecheck command (e.g. \`npm test\`, \`npm run typecheck\`) over a bespoke compiler invocation. The project's tests already passed; lean on its toolchain.
- For TypeScript specifically: DO NOT write a scratch \`tsconfig.json\` that \`extends\` the project's tsconfig. The project config typically pins \`rootDir\`/\`include\`, and a scratch file placed outside \`rootDir\` fails with \`TS6059: not under rootDir\` regardless of correctness. Instead either (a) put the scratch file INSIDE the project's source root, or (b) invoke the compiler standalone with NO project file: \`npx tsc --noEmit --skipLibCheck <file>.ts\`.
- Write scratch files under a temp dir you create; never assume you may add files anywhere in the tree.

# Hard rules — what TO do

Prefer (in priority order):
1. **Behavioral**: invoke the code or a smoke test, assert observable output.
2. **Compile-time**: a tiny program that imports and instantiates the new types — fails build if signatures wrong.
3. **Symbol presence via parser**: "type X is declared" yes; "the literal string Y appears" no.
4. **File existence**: fine.

The diff above shows what the worker actually built. Bind your assertions to the symbols and files in the diff, not to symbols you guess might exist.

Begin now.`;

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
