# One-shot delivery transport compatibility reference

> **Compatibility reference.** This preserves the detailed legacy transport
> contract formerly in the root README. Current workflow authority is
> [lean workflows](lean-workflows.md). In particular, the old statement that
> every Team task needs a separate validator is superseded: use independent
> validation/review proportionately or as explicitly requested.

The default `extensions/delivery-worker/` transport is model-only and
sequential. It accepts `delivery_worker` with `role`, `project`, `packet`,
`output`, and optional `timeout` only after an existing task execution request.
It has no background dispatch, recursive delegation, or concurrent writers.
Escape/operation cancellation and session shutdown abort the owned worker.

The coordinator widget reports observed phase/tool activity, monotonic elapsed
time, activity age, provider-reported cumulative tokens (including cache
usage), separate compaction usage, and terminal state. Narrow displays favor
role, state, tokens, and activity age. Usage may be pending/unavailable; quiet
only means no recent observed activity, not a hang. Tool errors do not alone
mean worker failure. It shows no thought text, arguments/results, or raw
errors. Completion remains acceptance/review pending. The CLI emits throttled
compact stderr progress and retains raw worker stderr; rendering failure does
not change transport results.

## Invocation and limits

The launcher needs Node 24+, `pi` on `PATH`, and macOS or Linux; it uses native
TypeScript execution without extra dependencies.

```bash
node scripts/delivery-agent.ts builder \
  --project /absolute/project/root \
  --packet /absolute/task-packet.md \
  --output /absolute/delivery/task-01-builder
```

Use `reviewer` for an independent review role when appropriate. The output
parent must already exist, and each invocation needs a new output directory.
The default timeout is 1,800 seconds; pass `--timeout SECONDS` to override it.
The packet must state approved scope, project rules, baseline, acceptance,
validation commands, and allowed actions. Reviewer packets also need the
complete task diff and validation evidence; see
`skills/delivery/references/delegation.md`.

## Grants and evidence

Workers use global model/thinking defaults and normal context files. The
launcher passes `--no-approve` to ignore trust-gated project resources,
`--no-extensions` with the explicit `builtin:codemode` exception, and
`--no-mcp`. It does not pass `--no-skills`, `--no-prompt-templates`, or
`--no-themes`: global resources are not blanket-disabled. Context files still
load regardless of project trust. `--offline` prevents automatic network
activity such as catalog refresh; it is not a network sandbox or a guarantee
that model requests are local. Put necessary task-specific guidance in the
packet rather than assuming a particular host's global resource inventory.

The builder allowlist is `read,grep,find,ls,bash,edit,write,codemode`; the
reviewer allowlist is `read,grep,find,ls,codemode`. Native codemode composes
these granted tools; it does not grant shell or mutation to the reviewer.
Neither role is filesystem-confined or OS-sandboxed. Scope, commit, and
outward-action restrictions remain instructions. The authoritative command
construction is `scripts/delivery-agent.ts`, `command()`.

Each invocation saves its packet, role prompt, complete raw JSONL stdout,
worker stderr, and status. Stdout is continuously captured with write
backpressure; malformed, truncated, or oversized records (over 8 MiB per
record) fail closed. Normally completed invocations also save `report.md`.
Evidence can contain sensitive data and must not be published blindly.

Exit codes are 0 for normal transport completion, 1 for failure, 124 for
timeout, and 130 for interruption. A completed status is not task acceptance:
the coordinator checks actual changes, validation evidence, and any requested
review. Cancellation attempts to stop the worker process group, but detached
children/external services can survive; inspect state and perform only approved
teardown. Failed runs retain evidence and may have changed files.

There is no automatic retry, resume, commit, push, or concurrent
implementation. After interruption, reconcile the repository and resources
before a fresh attempt. Run transport tests without model calls:

```bash
node --test tests/*.test.ts
```

For the opt-in tmux delivery adapter, roles, workspace isolation, saved pins,
and current resource policy, see [lean workflows](lean-workflows.md) and
[delivery workflow](delivery-workflow.md).
