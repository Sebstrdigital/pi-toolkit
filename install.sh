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

echo
echo "==> Installing pi-chains extension"
if [ ! -f "$CHAINS_SRC/package.json" ]; then
  echo "error: $CHAINS_SRC/package.json missing" >&2
  exit 1
fi

if [ ! -d "$CHAINS_SRC/node_modules" ]; then
  echo "    Running npm install in $CHAINS_SRC"
  (cd "$CHAINS_SRC" && npm install --no-audit --no-fund)
fi

echo "    Running: pi install $CHAINS_SRC"
pi install "$CHAINS_SRC"

echo
echo "==> Done."
echo "    Skills installed: $(ls -1 "$SKILLS_DEST" | wc -l | tr -d ' ')"
echo "    Try: pi, then /chain-list"
