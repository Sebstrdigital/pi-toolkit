#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
agent="$HOME/.pi/agent"

link() {
  local source="$1" target="$2"
  if [[ -L "$target" && "$(readlink "$target")" == "$source" ]]; then
    return
  fi
  if [[ -e "$target" || -L "$target" ]]; then
    printf 'Refusing to overwrite: %s\n' "$target" >&2
    exit 1
  fi
  ln -s "$source" "$target"
}

mkdir -p "$agent/skills"
link "$root/agent/AGENTS.md" "$agent/AGENTS.md"
for name in debug grill-me zoom-out duadigital-pdf-maker homelab-validation; do
  link "$root/skills/$name" "$agent/skills/$name"
done
