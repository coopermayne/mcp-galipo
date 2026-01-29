#!/bin/bash

# Install git hooks from scripts/hooks/ to .git/hooks/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
HOOKS_SRC="$SCRIPT_DIR/hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

echo "Installing git hooks..."

for hook in "$HOOKS_SRC"/*; do
    if [ -f "$hook" ]; then
        hook_name=$(basename "$hook")
        cp "$hook" "$HOOKS_DST/$hook_name"
        chmod +x "$HOOKS_DST/$hook_name"
        echo "  ✓ Installed $hook_name"
    fi
done

echo "Done!"
