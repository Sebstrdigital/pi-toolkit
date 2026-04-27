#!/usr/bin/env bash
set -euo pipefail

# pi-toolkit installer.
#   1. Symlinks pi-roles/<name> into ~/.pi/agent/skills/<name>
#   2. Installs the pi-chains extension into pi via `pi install <abs-path>`
#
# Idempotent: safe to re-run after pulling updates.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLES_SRC="$REPO_ROOT/pi-roles"
CHAINS_SRC="$REPO_ROOT/pi-chains"
UI_SRC="$REPO_ROOT/pi-ui"
TEAM_SRC="$REPO_ROOT/pi-team"
SKILLS_DEST="$HOME/.pi/agent/skills"

if ! command -v pi >/dev/null 2>&1; then
  echo "error: 'pi' CLI not found on PATH. Install pi first: https://github.com/badlogic/pi-mono" >&2
  exit 1
fi

echo "==> Symlinking roles into $SKILLS_DEST"
mkdir -p "$SKILLS_DEST"
for role_dir in "$ROLES_SRC"/*/; do
  [ -f "$role_dir/SKILL.md" ] || continue
  role_name="$(basename "$role_dir")"
  link="$SKILLS_DEST/$role_name"

  if [ -L "$link" ]; then
    current="$(readlink "$link")"
    if [ "$current" = "${role_dir%/}" ]; then
      echo "    ✓ $role_name (already linked)"
      continue
    fi
    echo "    → $role_name (relinking: was $current)"
    rm "$link"
  elif [ -e "$link" ]; then
    echo "    ! $role_name: $link exists and is not a symlink — skipping" >&2
    continue
  else
    echo "    + $role_name"
  fi
  ln -s "${role_dir%/}" "$link"
done

install_pi_package() {
  local label="$1" path="$2"
  echo
  echo "==> Installing $label extension"
  if [ ! -f "$path/package.json" ]; then
    echo "error: $path/package.json missing" >&2
    exit 1
  fi
  if [ ! -d "$path/node_modules" ]; then
    echo "    Running npm install in $path"
    (cd "$path" && npm install --no-audit --no-fund)
  fi
  echo "    Running: pi install $path"
  pi install "$path"
}

install_pi_package "pi-chains" "$CHAINS_SRC"
install_pi_package "pi-ui" "$UI_SRC"

# pi-team is intentionally NOT registered as a global extension — it's loaded
# explicitly via `pi -e <path>` from the `pi-team` wrapper. This keeps plain
# `pi` vanilla (no harness boot) while `pi-team` opts into harness mode.
echo
echo "==> pi-team extension"
if [ ! -d "$TEAM_SRC/node_modules" ]; then
  echo "    Running npm install in $TEAM_SRC"
  (cd "$TEAM_SRC" && npm install --no-audit --no-fund)
fi
echo "    Loaded on-demand by the pi-team wrapper (not globally registered)."

echo
echo "==> Linking pi-team wrapper into ~/.local/bin"
mkdir -p "$HOME/.local/bin"
WRAPPER_SRC="$REPO_ROOT/bin/pi-team"
WRAPPER_LINK="$HOME/.local/bin/pi-team"
if [ -L "$WRAPPER_LINK" ] && [ "$(readlink "$WRAPPER_LINK")" = "$WRAPPER_SRC" ]; then
  echo "    ✓ pi-team (already linked)"
elif [ -e "$WRAPPER_LINK" ] && [ ! -L "$WRAPPER_LINK" ]; then
  echo "    ! $WRAPPER_LINK exists and is not a symlink — skipping" >&2
else
  [ -L "$WRAPPER_LINK" ] && rm "$WRAPPER_LINK"
  ln -s "$WRAPPER_SRC" "$WRAPPER_LINK"
  echo "    + pi-team -> $WRAPPER_SRC"
fi
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo "    note: ~/.local/bin not on PATH; add it or call $WRAPPER_LINK directly" ;;
esac

echo
echo "==> Setting catppuccin-frappe as the active pi theme"
SETTINGS="$HOME/.pi/agent/settings.json"
if [ -f "$SETTINGS" ] && command -v node >/dev/null 2>&1; then
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const s = JSON.parse(fs.readFileSync(path, "utf8"));
    s.theme = "catppuccin-frappe";
    s.quietStartup = true;
    fs.writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
  ' "$SETTINGS"
  echo "    theme = catppuccin-frappe, quietStartup = true ($SETTINGS)"
else
  echo "    skipped — $SETTINGS not present (start pi once, then re-run installer)"
fi

echo
echo "==> Done."
echo "    Skills installed: $(ls -1 "$SKILLS_DEST" | wc -l | tr -d ' ')"
echo "    Try: pi, then /chain-list"
