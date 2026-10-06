---
name: debug
description: "Debug session tracker. Creates a breadcrumb trail file during debugging so you can close sessions and resume without losing context. Triggers on: debug, start debugging, fix bug, investigate issue."
---

# Debug Session Tracker

Maintain a lightweight breadcrumb trail during debugging so sessions can be closed and resumed without losing context.

## On Start

1. Look for `debug-active.md` in the project root.
   - If it exists, read it and summarize the current state to the user.
   - Otherwise, propose creating it with the template below and wait for approval.
   - Do not create the file for trivial fixes that take one step.

2. Initial template:

```markdown
# Active Debug Session

**Started:** [date]
**Repo:** [current repo/project name]
**Symptom:** [user-described problem]

## Current Hypothesis

[What we think is causing the issue]

## Trail

### Step 1
**Tried:** [what was done]
**Result:** [what happened]
**Next:** [what to try next]
```

## During Debugging

Propose updates to `debug-active.md` at these natural checkpoints; wait for approval before applying them:

- After reading code and forming or changing a hypothesis
- After running tests and seeing results
- After attempting a fix (whether it worked or not)
- After discovering something unexpected
- Before pivoting to a different approach

Keep entries short — 2-3 lines per step. This is a working trail, not documentation.

Keep **Current Hypothesis** aligned with the evidence.

End the latest step with a **Next** line — this is what a fresh session reads to know what to do.

## On Resolution

When the bug is fixed:

1. Propose a final trail entry noting the root cause.
2. Propose committing the fix; wait for approval. The commit message is the permanent record.
3. Ask before deleting `debug-active.md` — the file only exists during active debugging.
4. Confirm deletion only after it has happened.

## Rules

- Keep `debug-active.md` within ~50 lines. Propose summarizing older steps into a single "Summary so far" block, keeping only the last 3-4 detailed steps.
- The file is disposable. The commit history is the real record.
- If the user says "pause" or ends the session without resolving, propose a final **Next** line clearly describing what to try when resuming.
