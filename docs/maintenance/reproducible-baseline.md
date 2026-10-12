# Reproducible source baseline

This baseline packages the accepted toolkit source, not the personal Pi
installation or every historical execution artifact. Commit permission remains
separate from preparing and validating the candidate.

## Included source

The exact proposed path list and hashes are retained with the task evidence.
The candidate includes all previously tracked paths, current `agent/`, `agents/`,
`extensions/`, `scripts/`, `skills/`, `tests/`, and `vendor/` material, root setup
and guidance, top-level documentation, maintenance records, the three static
diagrams, and top-level workflow guides/retrospectives. The empty tracked
`AGENTS.override.md` is intentional shielding and remains included. Vendor
licenses, Addy's `UPSTREAM.json`, Pify's `INTEGRITY.json`, and historical runtime
patches/provenance are included. Vendored reference skills are not installed as
a second workflow.

## Retained outside this source candidate

`docs/delivery/` and `docs/workflows/first-release/` retain historical outcomes,
approvals, logs, fixture sessions, snapshots, patches, and recovery records in
the live checkout. They are not runtime/test dependencies of this baseline,
are not included in its proposed commit, and are not blanket-ignored. References
to those records remain historical evidence pointers, not promises that a fresh
clone contains the receipts. Cross-project retrospective links likewise require
the separately retained project. No historical content is erased or rewritten.

The pre-existing machine-local `CLAUDE.md` remains untouched and excluded.
External diagram-design tooling and personal settings, links, sessions,
credentials, and provider data are not candidate inputs.

`.gitignore` excludes only `.DS_Store`, the root Node compile cache, and the
thirteen explicitly observed delivery compile-cache directories. All existing
cache bytes remain in place; ignore rules are not deletion or retention expiry.
Source, outcome/provenance records, and other evidence remain visible to Git.
New cache locations need their own classification rather than a blanket pattern.

## Reproduction prerequisites and checks

The tested environment uses Node 25.9.0, Git, Bash, and the already installed
`@earendil-works/pi-coding-agent` host with its bundled dependencies. The suite
locates that host via `pi` on PATH or `npm root -g`; the candidate does not vendor
Pi itself. No dependency downloads or provider readiness are claimed. An older
Node without native TypeScript support is not a qualified environment.

Run `node --test tests/*.test.ts` from the candidate using disposable `HOME`,
`PI_CODING_AGENT_DIR`, and `NODE_COMPILE_CACHE` directories and `PI_OFFLINE=1`.
The existing suites use fake transport/provider backends and fake-HOME installer
fixtures, including conflicts and repeatability. Supplemental task checks cover
installed-resource discovery and candidate-only source/reference closure.
Do not install into the real HOME, reload Pi, invoke providers, or create real
transport panes merely to reproduce these fixture checks.

PDF rendering still requires Chrome; HomeLab guidance requires its SSH target.
The standalone browser qualification is not part of `tests/*.test.ts` and has
not been run for this packaging task. Diagram font/responsive/print checks and
live-provider/session qualification remain separate manual checks, not passes.

## Recovery

The task's external evidence directory retains the original HEAD/index entries,
pre-existing tracked diff, path/size inventory, source hashes, explicit included
and excluded manifests, candidate tree identity, validation receipts, and review
disposition. Existing activation preimages and housekeeping receipts remain at
the locations recorded in the [handoff](reproducible-baseline-handoff.md).
Reconcile hashes before any future application or commit; do not reset, stash,
clean, blanket-stage, or replay an old activation rollback over newer work.
