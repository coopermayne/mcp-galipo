---
name: test-as
description: Open a browser and log in as a selected user for manual testing
---

# Login as User

Open the frontend in a browser, already logged in as a chosen user. Optimized for speed — minimal tool calls.

## Step 1: Ask Which User

Ask the user for the **email address** to log in as (free text). Dev/seed users are not hardcoded here — enter whatever account exists in the current database.

If you want the password to come from the environment, set `TEST_LOGIN_PASSWORD` in `.env`; otherwise ask the user for the password.

## Step 2: Get Token AND Open Browser (IN PARALLEL)

**These two calls MUST happen in the same message (parallel tool calls):**

**Call A — Bash:** Load env, get token, and echo both token and VITE_PORT:
```bash
set -a && source .env 2>/dev/null && set +a
PORT=${PORT:-8000}
VITE_PORT=${VITE_PORT:-5173}

TOKEN=$(curl -s -X POST "http://localhost:$PORT/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USER_EMAIL\", \"password\": \"${TEST_LOGIN_PASSWORD:-$PASSWORD}\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token','FAIL'))")

echo "TOKEN=$TOKEN"
echo "VITE_PORT=$VITE_PORT"
```
Replace `$USER_EMAIL` with the chosen email, and supply the password via `TEST_LOGIN_PASSWORD` (env) or `$PASSWORD`.

**Call B — browser_navigate:** Navigate to `http://localhost:5173` (use VITE_PORT if known from env, default 5173).

## Step 3: Set Token and Reload

After both parallel calls complete, check the token from Call A:
- If token is `FAIL` → tell the user login failed, close browser, stop.
- Otherwise → use `browser_evaluate` to set the token and reload:

```
browser_evaluate → () => {
  localStorage.setItem('token', '<TOKEN>');
  window.location.href = '/';
}
```

**Do NOT wait or take a snapshot.** The user can see the browser themselves.

## Step 4: Report (brief)

One line: `Logged in as **[email]** — browser is open.`

Do NOT close the browser — the user needs it for manual testing.
