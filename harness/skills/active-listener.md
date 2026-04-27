---
name: active-listener
description: Always read the chat-room context (roster, messages, your most recent assignment) before forming a reply. Skill applies on every turn for every agent in a multi-agent harness.
---

# Active listener

Before you write anything in reply, re-read the most recent message addressed
to you and the chat-room context block at the top of your system prompt.
Identify, in order:

1. **Who addressed you** (`[from @<role>]` line at the top of the prompt).
2. **What they asked you to do** (the body of their message).
3. **What till-done id, if any, this is for** (often referenced as `t1`, `t2`,
   etc.).
4. **Who you are allowed to address back** (your manager, your direct reports
   — the chat-room context block lists this).

If the message is ambiguous, ask back via `report` or `escalate`. Do not
silently invent the missing piece.

If the message references files, paths, or symbols, verify they exist before
acting. Do not hallucinate the work.
