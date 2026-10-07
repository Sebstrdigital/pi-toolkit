# Vendored runtime — opt-in delivery integration

Origin: https://github.com/amosblomqvist/pi-interactive-subagents, package 3.7.2.
Pinned upstream base: `c3e8b53c0754ae5ccc19fdab5a7481ec039bc2f7`.
License: MIT, copyright (c) 2026 HazAT; see `LICENSE`.

The seven original modules under `pi-extension/subagents/` were copied byte-identically from the cumulative runtime accepted in toolkit Phase A and exercised in Phase B. Their relative layout is retained: bundled profiles and status configuration resolve two directories above the modules. No dependencies, unrelated upstream tools, or generic upstream agent profiles were copied. Production source does not import the temporary checkout.

`provenance/accepted-cumulative.patch` and `provenance/accepted-control.patch` retain the historical accepted corrections unchanged. They are provenance, not production entry points or test dependencies. The control patch preserves its historical temporary-checkout diff headers. The cumulative patch includes upstream test changes; those tests are not copied or executed here. The unrelated upstream `web_search` resolution assertion remains the acknowledged upstream baseline failure, not an excluded toolkit test.

## Newly approved correction delta

See `provenance/startup-correction.md` for the separately recorded builder-attempt-2 correction, accepted/correction source hashes, deterministic test evidence, and limits. That document describes the historical correction revision; current integration hashes are in `provenance/integration.md`. It changes only `index.ts` and `tmux.ts` and adds `surface-ownership.ts`: immediate owned-pane registration, rollback and retryable cleanup across fresh launch/resume/shutdown/reload, supplied-surface preservation, and suppression of parent-window retiling for delivery-role surfaces. The accepted patches and temporary candidate are unchanged. The original failing startup regression now passes without weakening its assertion.

## Integration resource delta

`agents/{builder,validator,reviewer}.md` are integration-owned portable role profiles. The original builder profile is unchanged; validator/reviewer were added in attempt 2. Runtime role grants still come from the accepted pinned `DELIVERY_TOOLS` definitions, including `ask_question`.

**Do not install this vendor entry point directly.** The supported entry point is `extensions/delivery-tmux/index.ts` at the repository root. It calls the narrow `registerDeliveryRuntime` hook only after the public host session-start collision check. Integration-only changes are separately documented and hashed in `provenance/integration.md`: fixed-only role resolution, pre-transport ownership publication, terminal/timeout/control hooks, namespaced and deferred lifecycle state, retained failed-cleanup launch denial, and paused terminal deadlines. Focused reviewer correction cycle 1 omits legacy child-count publication,
isolates delivery child count reading, and rejects combined correlated reply/rearm
before state changes. Current source/test hashes and deterministic negative-path
evidence are recorded in `provenance/integration.md`. The four unaffected accepted
modules and historical patches remain unchanged.

`install.sh --with-delivery-tmux` links only the delivery adapter. Default installation, one-shot extension and launcher behavior are unchanged. Portable repository tests include actual installed-loader/fake-backend integration and fake-HOME installation assertions; independent review, actual installation/reload, and live acceptance remain coordinator-only gates. No coordinator-owned records or Munin were written by this builder.

## Unchanged accepted source/resource SHA-256

Paths are relative to this vendor directory. Changed source hashes are recorded separately in `provenance/startup-correction.md`.

```text
2f8ef422f668e7e8fddfe084f37ebe6ee44865ce32c2a981a765bb6c213b2c61  pi-extension/subagents/activity.ts
5425335a120e3c7262c85300b91155d12cfa3aa6f73b605df4ec0257643ae814  pi-extension/subagents/control.ts
5001a63e56501a060c3f7747b44ff27608a0b3d4a13895e96a1faf0a2915083a  pi-extension/subagents/session.ts
85e563db0d1e135e75883e3f59d5ffca6448b4a3dbd8af0a37da8efc4d412b41  pi-extension/subagents/status.ts
3818f785cb9e8941b27c7f13ebf233022394275b05539660dc6a6ffbd8bb5b4d  LICENSE
ba66c8a956e6bfd247b4646bb525f4b6c00e4f0df9da216b1fe5f20fd184acb7  config.json.example
8524cce5cc38adae91c66fe4353639a76319fa52d26f3035691c5361ed37e5b9  agents/builder.md
936084b8b3b87867653797c0c421896f06f81227a05efa769ae516385f6da74d  provenance/accepted-control.patch
420713a422990b08cc96cf7f69c63ab5ffb94ac894b61acd1d11feab0434b97f  provenance/accepted-cumulative.patch
```

New fixed-profile SHA-256:

```text
9730ed8948130a161ce0aee56b1f08bbc24fe739253c0d0117f715451f7b69d1  agents/validator.md
83a9293dda6bdc44871b1a03b25cf3472bc70dcdb5a751032c1ad8f4dc530167  agents/reviewer.md
```
