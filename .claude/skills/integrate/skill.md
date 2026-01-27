---
name: integrate
description: Integrate feature branches from parallel repo copies into main
---

# Multi-Repo Branch Integration

Integrates feature branches from your parallel repo copies (mcp-galipo, mcp-galipo_2, mcp-galipo_3) into main, one at a time with proper rebasing.

## Prerequisites

- You should be in one of your galipo repo folders
- All feature work should be committed in each repo
- You should have pushed your feature branches to remote

## Procedure

### Step 1: Discover Branches

First, find all the repo copies and their current branches:

```bash
# Get the base directory (parent of current repo)
BASE_DIR=$(dirname "$(pwd)")
CURRENT_REPO=$(basename "$(pwd)")

echo "=== Branch Status Across Repos ==="
echo ""

for repo in mcp-galipo mcp-galipo_2 mcp-galipo_3; do
    REPO_PATH="$BASE_DIR/$repo"
    if [ -d "$REPO_PATH/.git" ]; then
        BRANCH=$(git -C "$REPO_PATH" branch --show-current)
        STATUS=$(git -C "$REPO_PATH" status --porcelain | wc -l | tr -d ' ')
        if [ "$STATUS" -gt 0 ]; then
            DIRTY=" (uncommitted changes!)"
        else
            DIRTY=""
        fi
        MARKER=""
        if [ "$repo" = "$CURRENT_REPO" ]; then
            MARKER=" <-- you are here"
        fi
        echo "$repo: $BRANCH$DIRTY$MARKER"
    fi
done
```

### Step 2: Identify Feature Branches

From the output above, identify which branches need to be merged. Branches named `main` or `master` can be skipped.

Ask the user: **"Which branches should I merge, and in what order?"**

Suggest ordering by:
1. Most independent changes first
2. Foundational/shared changes before dependent ones
3. Riskiest/largest changes last

### Step 3: Ensure Clean Working States

Before starting, verify all repos have clean working directories:

```bash
BASE_DIR=$(dirname "$(pwd)")

for repo in mcp-galipo mcp-galipo_2 mcp-galipo_3; do
    REPO_PATH="$BASE_DIR/$repo"
    if [ -d "$REPO_PATH/.git" ]; then
        STATUS=$(git -C "$REPO_PATH" status --porcelain)
        if [ -n "$STATUS" ]; then
            echo "WARNING: $repo has uncommitted changes:"
            echo "$STATUS"
            echo ""
        fi
    fi
done
```

If any repo has uncommitted changes, stop and ask the user to commit or stash them first.

### Step 4: Merge Each Branch (Repeat for Each)

For each feature branch in the chosen order:

#### 4a. Go to the repo with that branch and ensure it's pushed:

```bash
REPO_PATH="$BASE_DIR/$REPO_NAME"
cd "$REPO_PATH"

# Check if branch is pushed
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$(git branch --show-current) 2>/dev/null || echo "not-pushed")

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "Branch not pushed or out of sync with remote."
    echo "Local:  $LOCAL"
    echo "Remote: $REMOTE"
    # Ask user if they want to push
fi
```

#### 4b. Fetch latest main and rebase:

```bash
git fetch origin
git rebase origin/main
```

If there are conflicts:
- Stop and report: "Conflicts detected in [repo]. Please resolve manually, then run `/integrate` again."
- Show the conflicting files: `git diff --name-only --diff-filter=U`

If rebase succeeds:
```bash
git push --force-with-lease origin $(git branch --show-current)
```

#### 4c. Merge into main:

```bash
# Switch to main
git checkout main
git pull origin main

# Merge the feature branch
git merge origin/$FEATURE_BRANCH --no-ff -m "Merge branch '$FEATURE_BRANCH'"

# DO NOT PUSH - user handles this via lazygit
echo "Merged $FEATURE_BRANCH into main locally."
echo "Use lazygit to review and push when ready."
```

#### 4d. Update other repos' main:

After the user pushes, remind them to update main in other repos:

```bash
# In each other repo:
git checkout main
git pull origin main
```

### Step 5: Final Status

After all branches are merged, show final status:

```bash
BASE_DIR=$(dirname "$(pwd)")

echo "=== Final Branch Status ==="
echo ""

for repo in mcp-galipo mcp-galipo_2 mcp-galipo_3; do
    REPO_PATH="$BASE_DIR/$repo"
    if [ -d "$REPO_PATH/.git" ]; then
        BRANCH=$(git -C "$REPO_PATH" branch --show-current)
        echo "$repo: $BRANCH"
    fi
done

echo ""
echo "Integration complete. All repos should now be on main."
echo "You can delete merged feature branches with: git branch -d <branch-name>"
```

## Important Notes

- **No auto-push**: This skill never pushes automatically. Use lazygit to review and push.
- **Conflicts stop the process**: If a rebase has conflicts, you must resolve manually.
- **Order matters**: The merge order affects which branch deals with conflicts.
- **One at a time**: Each branch must be fully merged before starting the next.

## Troubleshooting

### Rebase Conflicts
```bash
# See conflicting files
git diff --name-only --diff-filter=U

# After resolving
git add <resolved-files>
git rebase --continue

# Or abort and try a different order
git rebase --abort
```

### Merge Conflicts
```bash
# See conflicts
git diff --name-only --diff-filter=U

# After resolving
git add <resolved-files>
git commit

# Or abort
git merge --abort
```

### Reset a Repo to Remote Main
```bash
git checkout main
git fetch origin
git reset --hard origin/main
```
