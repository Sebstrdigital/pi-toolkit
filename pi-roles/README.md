# pi-roles

Role library for [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). Each subdirectory is one pi skill — a `SKILL.md` defining a narrow role with hard tool restrictions and a strict output format.

Roles are reusable as standalone pi skills (`/skill:scout`, `/skill:builder`, etc.) or composed inside [pi-chains](../pi-chains/) chain definitions.

## Roles (v1)

| Role | Tools | Purpose |
|---|---|---|
| [`scout`](scout/SKILL.md) | `read grep find ls` | Read-only codebase reconnaissance |
| [`architect`](architect/SKILL.md) | `read grep find ls` | File-level change plan from scout findings |
| [`builder`](builder/SKILL.md) | `read write edit grep find ls` | Implements architect's plan; no test runs |
| [`verifier`](verifier/SKILL.md) | `read bash grep find ls` | Runs tests, produces PASS/FAIL verdict |
| [`reviewer`](reviewer/SKILL.md) | `read bash grep find ls` | APPROVE/REJECT on diff (read-only git only) |
| [`debugger`](debugger/SKILL.md) | `read bash grep find ls` | Root-cause investigation; no edits |

Spec source-of-truth: [`../docs/roles-library.md`](../docs/roles-library.md).

## Tool enforcement

Pi's `allowed-tools` frontmatter is experimental and lenient. Hard enforcement happens at spawn time via `pi --tools <csv>` — pi-chains reads each role's `allowed-tools` and passes it through. When invoking a role standalone outside of pi-chains, pass `--tools` yourself for the same gate.

## Install

`install.sh` symlinks each role directory into `~/.pi/agent/skills/` so pi discovers them without copying. Edits in this repo land immediately in pi.
