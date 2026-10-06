---
name: homelab-validation
description: Use when work needs a container, staging stack, database, build, or browser/API test environment. Prefer the HomeLab validation VM over MacBook-local runtimes.
---

# HomeLab Validation

- Host: `validation.local`; connect with `ssh validation` (user `debian`).
- Project root: `/srv/validation/projects/<slug>`.
- Builds run on x86_64; the Mac is arm64.
- Image registry: `homelab-registry` on port `5000`.
- Never auto-start the old MacBook Podman machine.

## Before starting

Probe the VM:

```bash
ssh validation 'hostname && podman --version && podman-compose --version && docker compose version >/dev/null 2>&1'
```

Read `/srv/validation/README.md` on the VM for its current rules.
Propose setup commands and teardown commands together; obtain approval
before making changes.

Create or reuse the project directory. Run container builds, compose
stacks, migrations, databases, and browser/API checks on the VM.
Use Caddy only when a stable browser/API endpoint is needed.
Keep workloads disposable; permanent services need explicit promotion.

## Teardown when idle

A project stack runs only while an agent actively tests against it,
or while waiting for the user to answer a manual-validation request.

- Tell the user that a manual-validation stack stays up until they answer.
- When idle, take it down in the same session using the approved teardown:
  `podman compose down`, or stop the relevant pod/quadlet units.
- Keep named volumes and images unless the user approves their removal.
- Before ending or handing off, list what you started and confirm its
  actual state. If teardown is blocked, report it explicitly.
- Never stop a stack another session is using. Ask about ownership when
  uncertain; ask before stopping a stack with no known owner.
- Never stop these always-on services: `homelab-registry`, Caddy,
  `gitlab-runner`.
