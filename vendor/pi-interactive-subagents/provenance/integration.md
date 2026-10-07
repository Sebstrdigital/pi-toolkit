# Phase C integration-only delta (builder continuation 3)

Base/license and accepted snapshot hashes are in `../PROVENANCE.md`. The accepted
Phase A patches are unchanged. `startup-correction.md` records the separate
approved startup correction and its pre-integration hashes. No temporary
candidate or historical evidence was modified. This document describes the
subsequent integration, not a rewrite of Phase A/B acceptance.

## Vendor modifications relative to the startup correction

- `index.ts`: named `registerDeliveryRuntime`, `hasDeliveryRun`, and
  `cancelDeliveryRun` production hooks. Delivery mode loads only bundled
  builder/validator/reviewer and validates their fixed profile structure; no
  generic command. Thinking selection remains independent of model selection.
  Pre-transport ownership publication and owned-session resolution are callbacks,
  not `__test__` imports. Runtime initialization moves out of module evaluation;
  timers/abort state use a vendor-path namespace and do not publish upstream's
  process-global custom-tool hook. Reload cleanup failure refuses startup.
  Watchers capture their own abort signal/hooks across reload. A fixed per-worker
  timeout explicitly cancels; preserved terminal-paused panes retain their
  original deadline and support stop. Teardown clears those deadlines through
  the owned module abort signal. Post-launch registry failure rolls back.
- `surface-ownership.ts`: ledger key is vendor-module-path namespaced, never
  upstream's global key. `hasOwnedSurfaces` exposes only the presence of retained
  ownership so failed closure prevents another worker launch. Startup rollback,
  run identity checks, retained cleanup failures, and no-retile behavior remain.
- `tmux.ts` retains the correction revision unchanged. The other four accepted
  modules, both historical patches, license/config and all three profiles remain
  unchanged from continuation baseline.

## Focused reviewer correction cycle 1

The first fresh review identified two blockers missed by the initial 73-test
suite. The vendor `index.ts` no longer publishes the legacy
`pi-subagents/running-children-count` callback, including during module evaluation.
Delivery children have no nested spawning grants; `subagent-done.ts` ignores that
legacy count only when `PI_SUBAGENT_DELIVERY=1`, preserving non-delivery reader
semantics. Independently installed upstream callbacks are never replaced or
mutated by delivery load, startup (including refusal), or teardown. The remaining
global symbol writes are vendor-path namespaced; the upstream registration hook
remains unpublished.

The adapter rejects `action: "rearm"` when either correlation field is present,
before ownership lookup, transport, reservation, or state changes. Accepted
matching-reply semantics are unchanged: only waiting is released; a subsequent
explicit work envelope clears interruption. Tests preserve a callback returning
seven (identity and result) through load/start/refused-start/shutdown/reload. A
new controlled installed-loader scenario drives the actual child question tool,
pause command, input and settlement handlers with captured fake transport. It
proves combined requests send nothing, preserve parent records and question/pause
sidecars, and leave the child latch intact; separate reply/work requests release
waiting and then interruption. No provider or real pane is involved.

## Adapter/lifecycle design

The repository adapter factory registers session events only: no tools, timers,
workers or cleanup. At `session_start`, the public bound `getAllTools` collision
check precedes vendor initialization. Then only the three proven controls are
registered, model-only and sequential. Public APIs used are event/tool
registration, getAllTools/getThinkingLevel, appendEntry, sendMessage, context
model/cwd, and session-manager identity/branch reads. No private host interface,
dependency, scheduler, or detached orchestration was added.

A synchronous launch/resume reservation protects against sibling calls. Running,
waiting and paused ownership holds the slot. Versioned branch entries pin parent,
name/run/session path, complete loadout, child-control resource URL and six
resource denials. External name registries are never ownership; missing/changed
snapshots and old/malformed ownership fail closed. Resume replays the pinned
loadout via the accepted runtime. Terminal state permits another fresh role,
never task acceptance. A failed close or persistence error prevents new work.

The adapter delegates idempotent shutdown to owned runtime hooks and isolates
cleanup errors. Unknown saved-active/crashed runs cannot be marked cleaned by
shutdown without current-instance ownership. They require explicit coordinator
reconciliation, not adoption. Normal live pause/rearm uses the proven child
protocol. If a paused child has actually exited, its pane/deadline remains owned;
stop/timeout can close it. Rearm of that non-live handle is refused until stop or
shutdown reconciliation, after which owned saved resume may be requested.

Notifications cap text at 16,000 characters and omit task data from message
metadata. Full session, loadout, scripts and failure evidence remain on disk.
This is not an OS sandbox or crash-durable broker; bash and reads are not path
confined. No universal third-party-abort guarantee is claimed.

## Current source/test SHA-256

Paths below are relative to the repository root. No dependency files changed.

```text
902bab07a41d09a824d7497d20cdabe89e598abfa4f9810f1575f7b0b6205bff  vendor/pi-interactive-subagents/pi-extension/subagents/index.ts
7ac9a5d8bfc3abfa9cef702d9b2d06a67b070a9fe2cfc13036adb808a788b1ca  vendor/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts
8448ff62e23d5b7d126d8e4efc9a80b320d914935e99eca0034d182c7184b770  vendor/pi-interactive-subagents/pi-extension/subagents/surface-ownership.ts
47a627b9c5409dff8626832eef4c30e5ea47b4d85db48c6a07279f6eb909e21a  vendor/pi-interactive-subagents/pi-extension/subagents/tmux.ts
bcf1a54a6e576748e8a7fc8cd46274ad38e5ed489fc4e4f1368a2fabd4cca3e3  extensions/delivery-tmux/index.ts
95f6cbf425f3282a8784b597ff8e0c679de76ac2420439425bc76b380a0450d5  tests/delivery-tmux-integration.test.ts
b2460a4ae78414ebf9960879df7acaffed7db4acd92e781914142cb30634a86c  tests/delivery-tmux-ownership.test.ts
d7c791444e043a00e3dc9cca4cdde917fc8223f6548747d6391f97230806cdf1  tests/delivery-tmux-startup.test.ts
```

## Evidence and pending gates

Portable tests derive the host from the installed CLI, use isolated fake HOME,
empty agent configuration, controlled PATH and fake tmux, and never invoke a
real pane/provider worker. Fifteen integration scenarios cover safe factory,
registration/collision, fixed overrides/grants, non-tmux refusal, sibling launch
reservation, correlated pause/reply/rearm, rollback, saved pinned resume,
timeout, shutdown/reload, persistence refusal, role limits, old/unresolved
ownership, retained cleanup failure and terminal-paused timeout. The original
17 startup/ownership regressions remain unchanged. Fake-HOME installer tests
cover unchanged default, repeatability and file/directory/link/dangling conflicts.

Repository checks do not certify live providers/tmux. Fresh independent review,
actual installation/user reload and the contract's installed disposable live
acceptance remain pending and coordinator-owned. No installation or acceptance
is claimed here. The unrelated upstream web_search resolution baseline test is
not copied into production tests; it remains explicitly documented, not hidden
or newly claimed passing.
