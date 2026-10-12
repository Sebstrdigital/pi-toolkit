# Native code mode

Native Pi `codemode` is enabled for the main agent and new fixed delivery workers. Direct tools remain available. Context Mode and Billion Context are not installed by this change.

## Main-agent configuration

The approved personal setup adds the following fields to `~/.pi/agent/settings.json`, preserving existing settings:

```json
{
  "defaultTools": ["+codemode"],
  "codemode": { "mode": "on" }
}
```

The toolkit installer does not currently apply these settings. On another installation, merge them deliberately: preserve an existing `defaultTools` selection rather than replacing it. Project settings or CLI tool restrictions may override the personal selection. Run `/reload` in the intended idle session to activate the configuration and updated instructions; do not reload another session or interrupt active workers.

## Worker configuration and resume

Both the one-shot launcher and fixed tmux launch/resume helper explicitly load `builtin:codemode` while retaining `--no-extensions` and `--no-mcp`. Discovered extensions, MCP servers and other previously denied resources stay disabled.

New fixed role grants are:

- Builder: read, grep, find, ls, bash, edit, write, codemode (plus ask_question in tmux).
- Validator: read, grep, find, ls, bash, codemode, ask_question (tmux only).
- Reviewer: read, grep, find, ls, codemode (plus ask_question in tmux).

Legacy saved tmux loadouts without code mode remain valid and replay their original grants. They are not silently upgraded. Fresh launches use the new profiles. Changed or malformed snapshots still fail closed.

## Usage policy

Before potentially large reads, repository/web searches, logs or bulk analysis, prefer code mode. Call existing tools from JavaScript, filter or aggregate their results, and return bounded evidence with source paths, failures, omissions and truncation notices. Use direct tools for small targeted work. Inspect exact relevant source before edits or semantic conclusions.

Bulk replacements can call the existing edit/write tools within approved scope. Serialize dependent mutations; parallel calls are only appropriate for independent operations. Completed actions are not rolled back when a script fails. Code mode does not expand role tool grants or approval authority, and it is not an OS sandbox.

Tool-level limits still apply. In particular, `read` may truncate large files before a script sees them; wrapping it does not provide an unlimited reader. Use bounded reads or appropriate allowed processing tools and retain coverage limits. Do not print a raw corpus or store it in code mode's small persistent store.

Native code mode also exposes its built-in classifier/image-model API; this change does not authorize additional model workloads or credentials. Existing orchestration tools remain model-only and cannot be invoked from scripts.

## Validation and limits

`tests/codemode.test.ts` exercises the installed native QuickJS implementation without provider calls or tmux panes. It checks output filtering, nested permission hooks, role restrictions, model-only tool exclusion, approved edit execution, and legacy snapshot validation. Launch/resume integration tests verify the explicit builtin extension and pinned tools with fake tmux transport.

These checks establish capability and tool boundaries, not universal model compliance. Real task comparisons of latency, cost and automatic tool selection remain pending in [the context-efficiency backlog](workflows/context-efficiency-backlog.md).

Upstream reference: https://pi.dev/docs/latest/codemode
