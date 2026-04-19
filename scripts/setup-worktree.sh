#!/bin/bash

# Set up a new git worktree with .env (unique ports) and dependencies.
# Called automatically by the post-checkout hook, or run manually:
#   ./scripts/setup-worktree.sh

set -e

MAIN_REPO="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's|/\.git$||')"
WORKTREE_DIR="$(pwd)"

if [ "$WORKTREE_DIR" = "$MAIN_REPO" ]; then
    echo "This is the main worktree — nothing to set up."
    exit 0
fi

echo "Setting up worktree: $WORKTREE_DIR"
echo "  Main repo: $MAIN_REPO"

# --- .env ---
if [ -f "$WORKTREE_DIR/.env" ]; then
    echo "  .env already exists, skipping"
else
    if [ ! -f "$MAIN_REPO/.env" ]; then
        echo "  ⚠ No .env in main repo to copy from"
    else
        cp "$MAIN_REPO/.env" "$WORKTREE_DIR/.env"

        # Bump ports to avoid collisions with the main worktree.
        # Count existing worktrees (excluding main) to pick a unique offset.
        WORKTREE_COUNT=$(git worktree list --porcelain | grep -c '^worktree ' || true)
        OFFSET=$(( (WORKTREE_COUNT - 1) * 10 ))

        if [ "$OFFSET" -gt 0 ]; then
            # Read current ports from the copied .env
            MAIN_PORT=$(grep -E '^PORT=' "$WORKTREE_DIR/.env" | cut -d= -f2 | tr -d '[:space:]')
            MAIN_BACKEND_PORT=$(grep -E '^BACKEND_PORT=' "$WORKTREE_DIR/.env" | cut -d= -f2 | tr -d '[:space:]')
            MAIN_VITE_PORT=$(grep -E '^VITE_PORT=' "$WORKTREE_DIR/.env" | cut -d= -f2 | tr -d '[:space:]')

            NEW_PORT=$((${MAIN_PORT:-8000} + OFFSET))
            NEW_BACKEND_PORT=$((${MAIN_BACKEND_PORT:-8000} + OFFSET))
            NEW_VITE_PORT=$((${MAIN_VITE_PORT:-5173} + OFFSET))

            sed -i '' "s/^PORT=.*/PORT=$NEW_PORT/" "$WORKTREE_DIR/.env"
            sed -i '' "s/^BACKEND_PORT=.*/BACKEND_PORT=$NEW_BACKEND_PORT/" "$WORKTREE_DIR/.env"
            sed -i '' "s/^VITE_PORT=.*/VITE_PORT=$NEW_VITE_PORT/" "$WORKTREE_DIR/.env"

            echo "  ✓ .env copied (ports: $NEW_PORT / $NEW_VITE_PORT)"
        else
            echo "  ✓ .env copied (same ports as main)"
        fi
    fi
fi

# --- Python venv ---
if [ -d "$WORKTREE_DIR/.venv" ]; then
    echo "  .venv already exists, skipping"
else
    if [ -f "$MAIN_REPO/requirements.txt" ]; then
        echo "  Creating Python venv..."
        python3 -m venv "$WORKTREE_DIR/.venv"
        "$WORKTREE_DIR/.venv/bin/pip" install -q -r "$MAIN_REPO/requirements.txt"
        echo "  ✓ .venv created and dependencies installed"
    else
        echo "  ⚠ No requirements.txt found, skipping venv"
    fi
fi

# --- Node modules ---
if [ -d "$WORKTREE_DIR/frontend/node_modules" ]; then
    echo "  node_modules already exists, skipping"
else
    if [ -f "$WORKTREE_DIR/frontend/package.json" ]; then
        echo "  Installing frontend dependencies..."
        (cd "$WORKTREE_DIR/frontend" && npm install --silent)
        echo "  ✓ node_modules installed"
    fi
fi

echo ""
echo "Worktree ready! To start working:"
echo "  cd $WORKTREE_DIR"
echo "  set -a && source .env && set +a"
