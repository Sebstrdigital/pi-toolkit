# Patterns to scan for

Each category below is what to look for. If a category yields no findings, omit it from output.

## Resource lifecycle

- Database connection / file handle / socket opened without close, defer, with-statement, or RAII
- Goroutine / Task / async job spawned without cancellation path
- Subscriber / observer registered without dispose / unsubscribe
- Timer / interval started without clear path
- Lock acquired without guaranteed release on early return or exception

## Concurrency

- Shared mutable state introduced without synchronization
- Race on a new field accessed from multiple threads/tasks/actors
- Reentrancy of a new method not considered when public surface allows it
- `await` / blocking call inside a held lock
- Unbounded queue / channel / list growth

## Coupling

- New global mutable state
- Reaching across module boundaries to access privates / internals
- Circular import or dependency introduced
- A new public API on one module that pulls in a transitive dependency the module didn't have

## Cohesion

- Single function doing two unrelated things (parse + IO + side-effect)
- Class mixing data + IO + presentation
- New abstraction that exists to be reused exactly once

## Error handling

- Caught and silently swallowed exception
- `try`/`catch` with empty body or `pass`
- Error returned but ignored at the new call site
- Generic `catch (Exception)` where a specific type would be safer
- Recovery path that hides the original cause

## Performance

- O(n²) loop where O(n) is trivial via map/set
- Synchronous I/O on a UI / hot path
- Large allocation inside a tight loop that could be hoisted
- Repeated work in a loop that could be memoized
- Unbounded growth (lists, maps, caches without eviction)

## API hygiene

- New public API without docstring / brief comment
- Breaking change to an existing public API not noted in commit message
- Mutable default arguments (Python) / shared `let` arrays (Swift) / shared object literals as defaults
- New flags/options that lack a documented default
- Inconsistent naming with the surrounding module

## Security baseline

- String concat into SQL / shell / URL
- Unvalidated user input into `exec` / `eval` / file paths
- Secrets committed to source
- Missing auth check on a new endpoint
- Insecure default for crypto / TLS / cookie

## Conventions (project-specific)

Read what the project documents. Common sources:
- `CLAUDE.md`, `.pi/AGENTS.md`
- `.editorconfig`, `.eslintrc*`, `.prettierrc`, `.swiftformat`, `pyproject.toml [tool.ruff]`
- Recent commit messages (last 5) for style hints

If the project documents no conventions, only flag universal anti-patterns above.
