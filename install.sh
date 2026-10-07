#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# All destinations/settings are preflighted before the helper changes any file.
exec node "$root/scripts/install-options.mjs" "$@"
