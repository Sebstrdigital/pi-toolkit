# Shared execution service

The Pi/tmux execution service is the boundary between engineering workflows and worker machinery. It is an internal module, not a separately published package or a new scheduler. The existing model-only tools are one client; another trusted workflow adapter can use the same service without registering those tools.

## Responsibilities

- `extensions/delivery-tmux/execution.ts`: session lifecycle, dispatch, owned workers, immutable saved pins, workspace exclusion, declared limits/replacement provenance, results/events and teardown.
- `extensions/delivery-tmux/requests.ts`: validated request contracts, existing Developer/Scout packet compatibility and task construction. The persisted `team`/`developer`/`scout` tags identify authority provenance, not development stages.
- `extensions/delivery-tmux/tools.ts`: existing Pi tool schemas, descriptions and rendering metadata; delegates all operations to the service.
- `extensions/delivery-tmux/index.ts`: compatibility entry point that composes the service and existing tool adapter.
- The vendored session/tmux runtime, role routing, workspace module and accounting module remain in place and unchanged.

An engineering workflow decides outcomes, slices, applicable skills, checks, independent review and acceptance. The service does not require DEFINE/PLAN/BUILD/VERIFY/REVIEW/SHIP, spec filenames, stage documents or per-slice human approvals. Project rules define actual validation commands and release procedures.

## Interface

`await createExecutionService(pi)` returns the one service for that exact source and host API, including imports through its installed symlink. Construction starts no workers, timers or panes. Operations become available on `session_start`; calls before startup, after shutdown, from another parent identity or against unreconciled ownership fail closed.

| Operation | Meaning |
| --- | --- |
| `launch(request, call)` | Launch a fixed-role worker after admission, routing and ownership checks. |
| `control(request, call)` | Steer, answer a correlated question, pause, rearm, stop or safely resume an owned name. |
| `profiles(call)` | Inspect the four bundled profiles without launching a worker. |
| `inspect(context)` | Obtain detached owned-state summaries; not completion polling or acceptance. |
| `onReady(listener)` | Obtain control definition metadata for tool binding; raw transport executors are never exposed. Returns an unsubscribe function. |
| `onEvent(listener)` | Receive launch, terminal, execution-time and bounded runtime messages. Returns an unsubscribe function. |

`call` carries `id`, the current Pi `context`, optional abort `signal` and optional `onUpdate` for transport progress. Runtime question/result notifications also reach the host's existing message channel. Events are notifications, not another authoritative state store; callback payloads are detached, and synchronous/asynchronous observer errors are logged without interrupting ownership transitions.

### Generic worker request

An extension can retain the service in its factory and call it from an authorized command/tool handler:

```typescript
// Example path for a sibling extension under extensions/<workflow>/.
import { createExecutionService } from "../delivery-tmux/execution.ts";

export default async function (pi) {
  const execution = await createExecutionService(pi);
  // Register your command/tool here. Inside its handler, after establishing
  // actual task authority:
  //
  // const result = await execution.launch({
  //   kind: "worker",
  //   params: {
  //     agent: "builder", // or "validator" / "reviewer"
  //     name: "feature-slice",
  //     task: "Outcome, acceptance, exclusions and relevant rules/source.",
  //     // cwd: an existing linked worktree of the current repository
  //   },
  // }, { id: toolCallId, context: ctx, signal, onUpdate });
}
```

The generic worker path requires no Developer packet or workflow stage. The caller must preserve real task authority; a task string or provenance reference does not authenticate user consent.

Two compatibility request kinds are also supported:
- `{ kind: "developer", params: { approvalRef, packetRef, packet, ... } }`: fixed builder, compact text or the existing structured packet.
- `{ kind: "scout", params: { discoveryAuthorityRef, question, sources, rules, exclusions, budget, resultContract, ... } }`: bounded supplied-source discovery with the existing fixed read-only grant and source-accessibility preflight.

Requests are copied before dispatch. Direct callers cannot inject role/tool/CLI overrides, select Scout through the generic worker path, adopt registry entries, convert saved provenance or bypass workspace ownership. Use `control` with the original references when continuing Developer/Scout or a declared assignment. Optional limits remain optional; declared limits do not reset.

## Boundaries retained

- Same-workspace ownership remains exclusive through pause/question waits. Concurrency requires distinct existing linked worktrees with the intended candidate.
- Role grants, saved models/thinking/identity/resource policy and legacy saved records are unchanged. New routing defaults do not rewrite saved sessions.
- Private-data consent, destructive actions, installation and publication still need applicable authority. Direct extension code is trusted executable code; this API is not an OS sandbox or a new model-callable grant.
- Model-facing controls remain model-only. Do not expose them through codemode merely because a trusted extension can call the service.
- The service returns execution outcomes, not product acceptance or release permission. The lead/workflow owns evidence assessment, repair decisions and final acceptance.
- No new retry policy, automatic fallback, commit, merge, deploy or worktree cleanup is introduced. This extraction does not remove the old workflow or change its engineering rules.

## Validation evidence

The loader/fixture suite exercises the existing tools and a second service client, including service-only use without legacy tool registration, request admission, fixed grants, linked-worktree concurrency, saved resume, provenance, question/control handling, transport failure and teardown. Fake HOME/tmux prevent real panes/provider calls. Fixture success is not a provider-entitlement check, live application validation or an independent agent review.
