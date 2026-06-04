#!/bin/bash
# Launches the Vite dev server for the Claude "preview" MCP / IDE preview tools.
#
# Two reasons this wrapper exists:
#   1. Node version — the preview tool inherits whatever `node` is first on PATH,
#      which may be older than Vite requires. We source nvm and `nvm use` so the
#      version pinned in frontend/.nvmrc (20) is selected automatically.
#   2. Proxy target — the preview MCP injects PORT=<its managed port> into this
#      process. vite.config.ts uses PORT for the /api proxy target, so without
#      pinning it the dev server would proxy /api back to itself → 500s. We pin
#      PORT to the backend (8000) and keep the dev server on VITE_PORT (5173).
#
# Referenced by .claude/launch.json. Override PORT/VITE_PORT via env if needed.

[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use >/dev/null 2>&1

export PORT="${PORT_BACKEND:-8000}"
export VITE_PORT="${VITE_PORT:-5173}"
exec npm run dev
