# pi-ui

Opinionated UX layer for pi-toolkit. Two pieces:

1. **Catppuccin Frappé theme** — bundled in `themes/`, picked up by pi automatically.
2. **One-line footer** — replaces pi's default multi-line footer with a condensed status line:

```
~/path (branch) │ provider/model │ thinking │ 12.4k/200k (6%) │ FREE
```

Cost segment shows `FREE` for free-tier models (pi's model config has `cost` all zeros) and `$0.0123` cumulative for paid API models, summed from `usage.cost.total` across each assistant message in the session.

Independent of `pi-chains`. Install either, both, or neither — they don't depend on each other.

## Install

`pi-toolkit/install.sh` installs both extensions and sets the theme. Standalone:

```bash
pi install <abs-path-to-pi-ui>
```

Then set the theme via `/settings` or in `~/.pi/agent/settings.json`:

```json
{ "theme": "catppuccin-frappe" }
```
