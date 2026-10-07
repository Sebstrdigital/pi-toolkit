# Phase C startup correction (builder attempt 2)

This is a separate, newly approved correction delta, not part of the historical accepted Phase A patches. Those two patches are unchanged. The temporary candidate and historical Phase A/B delivery records are unchanged.

## Source delta from the accepted seven-module snapshot

- `pi-extension/subagents/surface-ownership.ts` is new. It records each created pane synchronously before setup, shell-readiness waiting, artifact writes, or transport. A process-global owned-surface map survives reload. Only successful closure removes ownership; failed closure retains its original record and cleanup error for retry. Supplied surfaces are never adopted or closed by a borrowing run, even if the ledger already records a different original owner; watcher and rollback closure check run identity. Launch rollback records cancellation/failure evidence when storage permits, keeps the original thrown error authoritative, and isolates evidence/cleanup failures.
- `pi-extension/subagents/index.ts` uses that ownership layer in fresh launch, saved resume, watcher cleanup, shutdown, and reload. Fresh/resume setup and transport are inside rollback boundaries. Teardown during shell readiness cancels before transport; failure evidence is still written after teardown has already closed the pane. Shutdown synchronously retries all owned surfaces, including launches that never acquired a watcher. It reports persistence/cleanup failures without abandoning the ownership ledger. The existing `__test__` object additionally exposes `launchSubagent` solely for supplied-surface regression tests; no production adapter consumes it.
- `pi-extension/subagents/tmux.ts` accepts an explicit optional rebalance switch on creation/split/close. Delivery-role launches and owned closure pass false, suppressing parent-window `select-layout` on both success and rollback. Non-delivery behavior retains the original default rebalance policy.
- The other five accepted modules remain byte-identical. No child-control/question protocol or tool grants changed.

Accepted source SHA-256 before this correction:

```text
4ece2feeb00afb41df2bb655560fc2083a3780b967e5a0a3424750daa470996f  pi-extension/subagents/index.ts
2389b570fefa2d4753f5dcf43b077d70d6e280a992fa85abfbcbed2bc6226fbc  pi-extension/subagents/tmux.ts
```

Correction source SHA-256:

```text
f568ba789d737afa1fbb59090f2a572f6e51269239397d33c6b3f48eedd48e58  pi-extension/subagents/index.ts
47a627b9c5409dff8626832eef4c30e5ea47b4d85db48c6a07279f6eb909e21a  pi-extension/subagents/tmux.ts
fe236d8ecdb08bac57564ef95ac741244b4c19f4b1891f595a28038523d53f41  pi-extension/subagents/surface-ownership.ts
```

## Deterministic evidence and limits

`tests/delivery-tmux-startup.test.ts` retains the original failing cleanup assertion and adds explicit no-retile/idempotence assertions. `tests/delivery-tmux-ownership.test.ts` exercises fresh and saved-resume setup failure, transport failure, partially sent transport, cleanup failure with shutdown retry, cleanup failure with loader reload retry, teardown during shell readiness, and preservation of a supplied surface on failed launch/cancelled watcher. Tests derive the installed Pi loader location from the CLI at runtime; missing host fails, not skips. Each test uses its own fake HOME/agent directory and fake tmux executable. No actual panes, workers, providers, installation, or network are invoked.

Executed before the final run-identity additions: `node --test tests/delivery-tmux*.test.ts`, exit 0, 15/15. Final complete suite: `node --test tests/*.test.ts`, exit 0, 57/57 (including all 17 tmux regressions); `bash -n install.sh`, exit 0; `git diff --check`, exit 0. These are correction and existing-fallback gates, not evidence that production integration is complete. The adapter, single-active-worker reservation, fixed-only discovery enforcement, installer opt-in, workflow documentation, and associated integration tests are still absent. Independent review and coordinator-only installation/live acceptance remain pending.

The ledger is process-local across reload, not crash-durable. If storage fails, durable launch-failure evidence cannot be guaranteed; the original exception remains authoritative and failed-close ownership stays in memory. Tests do not certify real tmux/provider behavior or an OS sandbox.
