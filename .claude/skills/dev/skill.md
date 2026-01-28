---
name: dev
description: Start/restart all development servers (backend, frontend, postgres) and verify they're working
---

# Development Server Startup (Optimized)

Start or restart all development services with parallel startup and fast polling.

## Services Overview

| Service | Port | Health Check |
|---------|------|--------------|
| PostgreSQL | 5432 | Port connectivity |
| Backend (FastAPI) | $BACKEND_PORT (default 8000) | `GET /api/v1/chat/debug` |
| Frontend (Vite) | $VITE_PORT (default 5173) | HTTP 200 response |

**Note:** Ports are configured in `.env`. For multi-repo setups, each copy should have unique ports.

## Startup Procedure

### Step 1: Load Config & Check PostgreSQL

```bash
# Load environment
set -a && source .env && set +a
BACKEND_PORT=${BACKEND_PORT:-8000}
VITE_PORT=${VITE_PORT:-5173}

# Fast postgres check using nc (much faster than lsof)
if nc -z localhost 5432 2>/dev/null; then
    echo "PostgreSQL: already running"
else
    echo "PostgreSQL: starting..."
    # Try Postgres.app first (macOS GUI app)
    if [ -d "/Applications/Postgres.app" ]; then
        open -a Postgres
    # Try homebrew (any version)
    elif brew services list 2>/dev/null | grep -q postgresql; then
        POSTGRES_SERVICE=$(brew services list | grep postgresql | awk '{print $1}' | head -1)
        brew services start "$POSTGRES_SERVICE"
    # Check for docker postgres
    elif docker ps -a 2>/dev/null | grep -q postgres; then
        CONTAINER=$(docker ps -a | grep postgres | awk '{print $1}' | head -1)
        docker start "$CONTAINER"
    else
        echo "ERROR: No PostgreSQL installation found!"
        echo "Install via: Postgres.app, 'brew install postgresql', or Docker"
    fi
    # Poll for postgres (up to 5 seconds)
    for i in {1..25}; do
        nc -z localhost 5432 2>/dev/null && break
        sleep 0.2
    done
fi
nc -z localhost 5432 2>/dev/null && echo "PostgreSQL: OK" || echo "PostgreSQL: FAILED"
```

### Step 2: Kill Existing & Start Both Servers in Parallel

```bash
# Kill existing processes (fast, no sleep needed after)
kill -9 $(lsof -ti:$BACKEND_PORT) 2>/dev/null || true
kill -9 $(lsof -ti:$VITE_PORT) 2>/dev/null || true

# Start backend
source .venv/bin/activate
uvicorn main:app --reload --port $BACKEND_PORT > /tmp/backend_$BACKEND_PORT.log 2>&1 &

# Start frontend (check node version first, only load nvm if needed)
cd frontend
NODE_MAJOR=$(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 20 ]; then
    source ~/.nvm/nvm.sh 2>/dev/null && nvm use 20 2>/dev/null || true
fi
VITE_PORT=$VITE_PORT BACKEND_PORT=$BACKEND_PORT npm run dev > /tmp/frontend_$VITE_PORT.log 2>&1 &
cd ..

echo "Started backend and frontend in parallel..."
```

### Step 3: Poll for Both Services (with timeout)

```bash
# Poll both services in parallel (max 15 seconds total)
BACKEND_OK=false
FRONTEND_OK=false

for i in {1..30}; do
    # Check backend if not yet OK
    if [ "$BACKEND_OK" = false ]; then
        if curl -s --max-time 1 http://localhost:$BACKEND_PORT/api/v1/chat/debug 2>/dev/null | grep -q "ok"; then
            BACKEND_OK=true
            echo "Backend: ready (${i}x0.5s)"
        fi
    fi

    # Check frontend if not yet OK
    if [ "$FRONTEND_OK" = false ]; then
        if curl -s --max-time 1 -o /dev/null -w "%{http_code}" http://localhost:$VITE_PORT 2>/dev/null | grep -q "200"; then
            FRONTEND_OK=true
            echo "Frontend: ready (${i}x0.5s)"
        fi
    fi

    # Exit early if both are ready
    if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
        break
    fi

    sleep 0.5
done
```

### Step 4: Final Status Summary

```bash
echo ""
echo "=== Dev Server Status ==="

# PostgreSQL
if nc -z localhost 5432 2>/dev/null; then
    echo "PostgreSQL: OK (port 5432)"
else
    echo "PostgreSQL: FAILED - port 5432 not listening"
fi

# Backend
if curl -s --max-time 2 http://localhost:$BACKEND_PORT/api/v1/chat/debug 2>/dev/null | grep -q "ok"; then
    echo "Backend:    OK (port $BACKEND_PORT)"
else
    echo "Backend:    FAILED - check /tmp/backend_$BACKEND_PORT.log"
fi

# Frontend
if curl -s --max-time 2 -o /dev/null -w "%{http_code}" http://localhost:$VITE_PORT 2>/dev/null | grep -q "200"; then
    echo "Frontend:   OK (port $VITE_PORT)"
else
    echo "Frontend:   FAILED - check /tmp/frontend_$VITE_PORT.log"
fi

echo ""
echo "Frontend URL: http://localhost:$VITE_PORT"
```

## Quick Reference

### View Logs
```bash
set -a && source .env && set +a
tail -f /tmp/backend_$BACKEND_PORT.log   # Backend logs
tail -f /tmp/frontend_$VITE_PORT.log     # Frontend logs
```

### Stop All Services
```bash
set -a && source .env && set +a
kill -9 $(lsof -ti:${BACKEND_PORT:-8000}) 2>/dev/null
kill -9 $(lsof -ti:${VITE_PORT:-5173}) 2>/dev/null
```

### Restart Just Backend
```bash
set -a && source .env && set +a
kill -9 $(lsof -ti:$BACKEND_PORT) 2>/dev/null
source .venv/bin/activate
uvicorn main:app --reload --port $BACKEND_PORT > /tmp/backend_$BACKEND_PORT.log 2>&1 &
```

### Restart Just Frontend
```bash
set -a && source .env && set +a
kill -9 $(lsof -ti:$VITE_PORT) 2>/dev/null
cd frontend
VITE_PORT=$VITE_PORT BACKEND_PORT=$BACKEND_PORT npm run dev > /tmp/frontend_$VITE_PORT.log 2>&1 &
cd ..
```

## Troubleshooting

### Backend won't start
1. Check if port is in use: `nc -z localhost $BACKEND_PORT && echo "in use"`
2. Check database: `nc -z localhost 5432 && echo "postgres OK"`
3. Verify .env exists: `cat .env`
4. Check logs: `tail -50 /tmp/backend_$BACKEND_PORT.log`

### Frontend won't start
1. Check if port is in use: `nc -z localhost $VITE_PORT && echo "in use"`
2. Check node version: `node -v` (needs 20+)
3. Check node_modules: `ls frontend/node_modules`
4. If missing: `cd frontend && npm install`
5. Check logs: `tail -50 /tmp/frontend_$VITE_PORT.log`

### Database connection errors
Start postgres based on your installation:
- **Postgres.app**: `open -a Postgres` (or click the elephant icon in menu bar)
- **Homebrew**: `brew services start postgresql` (or `postgresql@14`, `postgresql@15`, etc.)
- **Docker**: `docker start <container_name>`

Then verify:
1. Check postgres is running: `nc -z localhost 5432 && echo "OK"`
2. Check DATABASE_URL in .env matches your local setup
3. Verify database exists: `psql -l | grep galipo`

---

Execute these steps, reporting the final status summary to the user.
