# Development Setup Guide

This guide walks you through setting up a local development environment for Galipo from scratch.

## Prerequisites

- **Python 3.12+**
- **Node.js 20+** (with npm)
- **PostgreSQL 15+**
- **Git**

## 1. Clone the Repository

```bash
git clone <repo-url>
cd mcp-galipo
```

## 2. Set Up PostgreSQL

### Option A: Local PostgreSQL

Install PostgreSQL and create a database:

```bash
# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database and user
psql -U postgres
CREATE DATABASE galipo;
CREATE USER galipo_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE galipo TO galipo_user;
\q
```

### Option B: Docker PostgreSQL

```bash
docker run -d \
  --name galipo-postgres \
  -e POSTGRES_DB=galipo \
  -e POSTGRES_USER=galipo_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15
```

## 3. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Database connection
DATABASE_URL=postgresql://galipo_user:your_password@localhost:5432/galipo

# Authentication (for web dashboard)
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_password

# Server port (optional, defaults to 8000)
PORT=8000

# Reset database on startup (use with caution!)
# RESET_DB=true
```

Alternatively, export them in your shell:

```bash
export DATABASE_URL="postgresql://galipo_user:your_password@localhost:5432/galipo"
export AUTH_USERNAME="admin"
export AUTH_PASSWORD="your_secure_password"
```

## 4. Set Up Python Backend

### Create a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Initialize the database

The database tables are created automatically when you first run the server. If you need to reset the database:

```bash
export RESET_DB=true
python main.py
# Then unset to avoid accidental resets
unset RESET_DB
```

### Run database migrations

After pulling new code, check if there are pending migrations:

```bash
source .venv/bin/activate
python migrations/run_migration.py
```

Or run a specific migration:

```bash
python migrations/run_migration.py 001_remove_court_id_from_cases.sql
```

## 5. Set Up Frontend

```bash
cd frontend
npm install
cd ..
```

## 6. Run Development Servers

You'll need two terminal windows/tabs:

### Terminal 1: Backend (FastAPI + MCP Server)

```bash
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

The backend serves:
- MCP server at `http://localhost:8000/sse`
- REST API at `http://localhost:8000/api/v1/*`
- Legacy frontend at `http://localhost:8000/legacy`

### Terminal 2: Frontend (Vite Dev Server)

```bash
cd frontend
npm run dev
```

The frontend development server runs at `http://localhost:3000` with hot module replacement.

## 7. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/v1/
- **MCP Server**: http://localhost:8000/sse
- **Legacy Frontend**: http://localhost:8000/legacy

Login with the credentials you set in `AUTH_USERNAME` and `AUTH_PASSWORD`.

## Development Workflow

### Backend Changes

The backend uses `--reload` flag, so changes to Python files will automatically restart the server.

Key files:
- `main.py` - FastAPI app and MCP server setup
- `database.py` - Database connection and table creation
- `tools.py` - MCP tool definitions
- `routes.py` - REST API endpoints
- `auth.py` - Authentication logic

### Frontend Changes

Vite provides hot module replacement, so changes to React components will update immediately in the browser.

Key directories:
- `frontend/src/pages/` - Route pages
- `frontend/src/components/` - Reusable components
- `frontend/src/api/` - API client
- `frontend/src/types/` - TypeScript interfaces

### Running Type Checks

```bash
# Frontend TypeScript
cd frontend
npm run type-check

# Or watch mode
npm run type-check:watch
```

### Running Linter

```bash
cd frontend
npm run lint
```

## Building for Production

### Build Frontend

```bash
cd frontend
npm run build
```

This creates a `dist/` folder with the production build.

### Run Production Server

The production server serves both the API and the built frontend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Docker Build

```bash
docker build -t galipo .
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_USERNAME="admin" \
  -e AUTH_PASSWORD="password" \
  galipo
```

### Production Migrations

**Important:** Before deploying new code to production, run any pending migrations:

```bash
# Run migrations against production database
DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/galipo" \
  python migrations/run_migration.py
```

For Docker deployments, run migrations before starting the app:

```bash
# Run migrations first
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  galipo python migrations/run_migration.py

# Then start the app
docker run -d -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_USERNAME="admin" \
  -e AUTH_PASSWORD="password" \
  galipo
```

## Connecting Claude to Local Server

For local development, you can connect Claude Code to your local MCP server:

1. Run the backend server
2. In Claude Code settings, add:
   ```
   http://localhost:8000/sse
   ```

Note: Claude.ai web cannot connect to localhost. For testing with Claude.ai, you'll need to deploy to a public URL or use a tunneling service like ngrok.

## Troubleshooting

### Database Connection Errors

- Ensure PostgreSQL is running
- Verify `DATABASE_URL` is correct
- Check that the database and user exist

### Port Already in Use

```bash
# Find what's using port 8000
lsof -i :8000

# Kill the process or use a different port
uvicorn main:app --reload --port 8001
```

### Frontend Can't Connect to Backend

- Ensure backend is running on port 8000
- Check browser console for CORS errors
- The Vite dev server proxies `/api` requests to the backend

### MCP Connection Issues

- Ensure SSE transport is not being buffered by a proxy
- Check that the `/sse` endpoint is accessible
- Verify no firewall is blocking the connection

## Useful Commands

```bash
# Activate virtual environment
source .venv/bin/activate

# Run backend with auto-reload
uvicorn main:app --reload --port 8000

# Run frontend dev server
cd frontend && npm run dev

# Build frontend for production
cd frontend && npm run build

# Check TypeScript types
cd frontend && npm run type-check

# Lint frontend code
cd frontend && npm run lint

# Run database migrations
python migrations/run_migration.py

# Connect to database
psql $DATABASE_URL
```
