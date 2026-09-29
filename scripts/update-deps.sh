#!/usr/bin/env bash
# Regenerate requirements.txt (the pinned lockfile) from requirements.in.
#
#   ./scripts/update-deps.sh                  # re-lock, keep existing pins (after editing requirements.in)
#   ./scripts/update-deps.sh --upgrade        # bump everything to latest allowed by requirements.in
#   ./scripts/update-deps.sh -P anthropic     # bump just one package (repeatable)
#
# Resolves for the production image (Python 3.12, Linux) regardless of the
# local machine. Afterwards: review the diff, install locally, smoke-test,
# then push to staging before merging.
set -euo pipefail

cd "$(dirname "$0")/.."

UV=".venv/bin/uv"
if [ ! -x "$UV" ]; then
    echo "uv not found in .venv — install it with: .venv/bin/pip install uv" >&2
    exit 1
fi

"$UV" pip compile requirements.in \
    --output-file requirements.txt \
    --python-version 3.12 \
    --python-platform x86_64-manylinux_2_28 \
    --no-header \
    --quiet \
    "$@"

echo "requirements.txt updated. Changes:"
git --no-pager diff --stat requirements.txt
echo
echo "Next: .venv/bin/pip install -r requirements.txt, test locally, push to staging."
