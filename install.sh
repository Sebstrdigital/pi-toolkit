#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
agent="$HOME/.pi/agent"
with_delivery_tmux=false
for option in "$@"; do
  case "$option" in
    --with-delivery-tmux) with_delivery_tmux=true ;;
    *) printf 'Unknown option: %s\n' "$option" >&2; exit 1 ;;
  esac
done

# Opt-in conflict preflight: preserve every existing/dangling destination.
if $with_delivery_tmux; then
  target="$agent/extensions/delivery-tmux"
  source="$root/extensions/delivery-tmux"
  if [[ -e "$target" || -L "$target" ]]; then
    if [[ ! -L "$target" || "$(readlink "$target")" != "$source" ]]; then
      printf 'Refusing to overwrite: %s\n' "$target" >&2
      exit 1
    fi
  fi
fi

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

mkdir -p "$agent/skills" "$agent/extensions"
link "$root/agent/AGENTS.md" "$agent/AGENTS.md"
for name in debug grill-me zoom-out duadigital-pdf-maker homelab-validation delivery; do
  link "$root/skills/$name" "$agent/skills/$name"
done
link "$root/extensions/delivery-worker" "$agent/extensions/delivery-worker"
if $with_delivery_tmux; then
  link "$root/extensions/delivery-tmux" "$agent/extensions/delivery-tmux"
fi
