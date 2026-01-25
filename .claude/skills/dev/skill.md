---
name: dev
description: Start/restart all development servers (backend, frontend, postgres) and verify they're working
---

# Development Server Startup

Start or restart all development services and verify each is working correctly.

## Services Overview

| Service | Port | Health Check |
|---------|------|--------------|
| PostgreSQL | 5432 | Port connectivity or process check |
| Backend (FastAPI) | 8000 | `GET /api/v1/chat/debug` |
| Frontend (Vite) | 5173 | HTTP 200 response |

## Startup Procedure

### Step 1: Check/Start PostgreSQL

Check if postgres is running using multiple fallback methods:

```bash
# Method 1: Check if port 5432 is listening (works universally)
lsof -i:5432 >/dev/null 2>&1 && echo "PostgreSQL: port 5432 is open" || echo "PostgreSQL: port 5432 not listening"

# Method 2: Check for postgres processes
pgrep -x postgres >/dev/null 2>&1 && echo "PostgreSQL: process running" || echo "PostgreSQL: no process found"
```

If not running, try to start it based on available installation:

```bash
# Try Postgres.app first (macOS GUI app)
if [ -d "/Applications/Postgres.app" ]; then
    open -a Postgres
    echo "Started Postgres.app - wait a few seconds for it to initialize"
    sleep 3
# Try homebrew (any version)
elif brew services list 2>/dev/null | grep -q postgresql; then
    POSTGRES_SERVICE=$(brew services list | grep postgresql | awk '{print $1}' | head -1)
    brew services start "$POSTGRES_SERVICE"
    sleep 2
# Check for docker postgres
elif docker ps -a 2>/dev/null | grep -q postgres; then
    CONTAINER=$(docker ps -a | grep postgres | awk '{print $1}' | head -1)
    docker start "$CONTAINER"
    sleep 2
else
    echo "ERROR: No PostgreSQL installation found!"
    echo "Install via: Postgres.app, 'brew install postgresql', or Docker"
fi
```

Verify postgres is running:
```bash
lsof -i:5432 >/dev/null 2>&1 && echo "PostgreSQL: OK" || echo "PostgreSQL: FAILED to start"
```

### Step 2: Stop Existing Processes

```bash
# Kill any existing backend/frontend processes
kill -9 $(lsof -ti:8000) 2>/dev/null || true
kill -9 $(lsof -ti:5173) 2>/dev/null || true
sleep 1
```

### Step 3: Start Backend

**IMPORTANT:** Must source `.env` file for DATABASE_URL and other config.

```bash
cd /Users/coopermayne/Code/mcp-galipo
source .venv/bin/activate
set -a && source .env && set +a
uvicorn main:app --reload --port 8000 > /tmp/backend.log 2>&1 &
```

Wait 3 seconds for startup, then verify:
```bash
curl -s http://localhost:8000/api/v1/chat/debug
```

Expected response: `{"status":"ok","message":"Chat routes are registered!"}`

If it fails, check logs:
```bash
tail -30 /tmp/backend.log
```

Common issues:
- **Address already in use**: Port 8000 not properly killed, retry kill command
- **Database connection error**: PostgreSQL not running or .env not sourced
- **Module not found**: Virtual environment not activated

### Step 4: Start Frontend

**IMPORTANT:** Vite requires Node.js 20.19+ or 22.12+. Use nvm/fnm to switch if needed.

```bash
cd /Users/coopermayne/Code/mcp-galipo/frontend
# Ensure correct Node version (20+)
source ~/.nvm/nvm.sh 2>/dev/null && nvm use 20 2>/dev/null || true
npm run dev > /tmp/frontend.log 2>&1 &
```

Wait 2 seconds for startup, then verify:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Expected response: `200`

If it fails, check logs:
```bash
tail -20 /tmp/frontend.log
```

### Step 5: Final Verification Summary

Run all checks and report status:

```bash
echo "=== Dev Server Status ==="
echo ""

# PostgreSQL - check port 5432 (works with any postgres installation)
if lsof -i:5432 >/dev/null 2>&1; then
    echo "PostgreSQL: OK (port 5432)"
else
    echo "PostgreSQL: FAILED - port 5432 not listening"
fi

# Backend
BACKEND=$(curl -s http://localhost:8000/api/v1/chat/debug 2>/dev/null)
if [[ "$BACKEND" == *"ok"* ]]; then
    echo "Backend:    OK (port 8000)"
else
    echo "Backend:    FAILED - check /tmp/backend.log"
fi

# Frontend
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null)
if [[ "$FRONTEND" == "200" ]]; then
    echo "Frontend:   OK (port 5173)"
else
    echo "Frontend:   FAILED - check /tmp/frontend.log"
fi

echo ""
echo "Frontend URL: http://localhost:5173"
```

## Quick Reference

### View Logs
```bash
tail -f /tmp/backend.log   # Backend logs
tail -f /tmp/frontend.log  # Frontend logs
```

### Stop All Services
```bash
kill -9 $(lsof -ti:8000) 2>/dev/null  # Stop backend
kill -9 $(lsof -ti:5173) 2>/dev/null  # Stop frontend
```

### Restart Just Backend
```bash
kill -9 $(lsof -ti:8000) 2>/dev/null
cd /Users/coopermayne/Code/mcp-galipo
source .venv/bin/activate && set -a && source .env && set +a
uvicorn main:app --reload --port 8000 > /tmp/backend.log 2>&1 &
```

### Restart Just Frontend
```bash
kill -9 $(lsof -ti:5173) 2>/dev/null
cd /Users/coopermayne/Code/mcp-galipo/frontend
source ~/.nvm/nvm.sh 2>/dev/null && nvm use 20 2>/dev/null || true
npm run dev > /tmp/frontend.log 2>&1 &
```

## Troubleshooting

### Backend won't start
1. Check if port is in use: `lsof -i:8000`
2. Check database: `lsof -i:5432` or `pgrep -x postgres`
3. Verify .env exists: `cat /Users/coopermayne/Code/mcp-galipo/.env`
4. Check logs: `tail -50 /tmp/backend.log`

### Frontend won't start
1. Check if port is in use: `lsof -i:5173`
2. Check node_modules: `ls frontend/node_modules`
3. If missing: `cd frontend && npm install`
4. Check logs: `tail -50 /tmp/frontend.log`

### Database connection errors
Start postgres based on your installation:
- **Postgres.app**: `open -a Postgres` (or click the elephant icon in menu bar)
- **Homebrew**: `brew services start postgresql` (or `postgresql@14`, `postgresql@15`, etc.)
- **Docker**: `docker start <container_name>`

Then verify:
1. Check postgres is running: `lsof -i:5432`
2. Check DATABASE_URL in .env matches your local setup
3. Verify database exists: `psql -l | grep galipo`

---

Execute these steps in order, reporting the final status summary to the user.
