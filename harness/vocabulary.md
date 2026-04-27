# Harness Vocabulary

A small set of information-dense keywords every agent in the harness understands.
Keep this list short. Add words only when they pull weight.

Agents address each other directly inside the chat-room runtime — there is no
human relay. The harness parses every line of agent output for these patterns
and routes accordingly.

## @mention (delegation / addressing)

**Format:** `@<role> <free-text>`
**Use:** orchestrator → lead, lead → worker, worker → lead, lead → orchestrator,
or any cross-tier ping.
**Meaning:** the rest of the line (and any following lines until the next
`@<role>` or status verb) is a message routed to that agent. The mention IS
the routing primitive — no `delegate` keyword, no colon.

Example:

    @ui-lead Add a debug panel to the sandbox UI showing the active model.
    Keep it inside src/components/.

The orchestrator's `@ui-lead` line is delivered to the ui-lead agent's session.

## report

**Format:** `report <to-role>: <summary>`
**Use:** worker → lead, lead → orchestrator, orchestrator → user.
**Meaning:** surface a result, finding, or non-blocking issue to the named
recipient. Keeps the colon to distinguish from `@mention` routing.

## done

**Format:** `done: <task-id>`
**Use:** any agent.
**Meaning:** a till-done item is complete. Closes the item.

## escalate

**Format:** `escalate <to-role>: <reason>`
**Use:** any agent → its parent tier (worker → lead, lead → orchestrator,
orchestrator → user).
**Meaning:** "I cannot continue without breaking my rules." Differs from
`report` in two ways:
1. The work is **not** complete — escalation halts the task.
2. The recipient must **decide** what to do (split the task, change scope,
   override a rule, abort).

Typical triggers:
- Worker would have to write outside its `scope` to complete the task.
- Worker would have to use a tool it does not have.
- Lead's workers have all failed and the lead would have to break the
  no-write rule indefinitely.
- Orchestrator has no working lead for the assignment.

`escalate` is for **rule conflicts**. `report` is for normal results,
including failures the recipient does not need to decide on.
