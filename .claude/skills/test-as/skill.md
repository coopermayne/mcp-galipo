---
name: test-as
description: Open a browser and log in as a selected user for manual testing
---

# Login as User

Open the frontend in a browser, already logged in as a selected user, so you can start testing immediately.

## Step 1: Ask Who to Log In As

Use AskUserQuestion to present the user selection. The top 3 are pinned; the rest are listed under "Other".

```
question: "Who do you want to log in as?"
header: "User"
options:
  - label: "Cooper Mayne"
    description: "cmayne@example.com"
  - label: "Darci Gilbert"
    description: "dgilbert@example.com"
  - label: "Dave Galipo"
    description: "davegalipo@example.com"
  - label: "Someone else"
    description: "Pick from the full user list"
```

If the user selects "Someone else", use AskUserQuestion again with these options:

```
question: "Which user?"
header: "User"
options:
  - label: "Santiago Laurel"
    description: "slaurel@example.com"
  - label: "Leslie DeLeon"
    description: "ldeleon@example.com"
  - label: "Dale Galipo"
    description: "someone@example.com"
  - label: "Another user"
    description: "Enter email manually"
```

Map the selected user to their email:
- Cooper Mayne → cmayne@example.com
- Darci Gilbert → dgilbert@example.com
- Dave Galipo → davegalipo@example.com
- Santiago Laurel → slaurel@example.com
- Leslie DeLeon → ldeleon@example.com
- Dale Galipo → someone@example.com

If "Another user" is selected, ask for the email as free text.

## Step 2: Get the Auth Token

Load environment variables and call the login API to get a JWT token for the selected user. The dev password for all users is `home3232`.

```bash
set -a && source .env 2>/dev/null && set +a
PORT=${PORT:-8000}

# Login and capture the token
RESPONSE=$(curl -s -X POST "http://localhost:$PORT/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USER_EMAIL\", \"password\": \"galipo2025\"}")

echo "$RESPONSE"
```

Replace `$USER_EMAIL` with the selected user's email.

Check the response:
- If `"success": true` → extract the `token` field
- If `"success": false` → tell the user login failed and show the error message. Do NOT proceed.

## Step 3: Open Browser with Playwright and Set Token

Use the Playwright MCP tools to:

1. Navigate to the frontend URL:
```
browser_navigate → http://localhost:$VITE_PORT
```
(VITE_PORT from .env, default 5173)

2. Set the auth token in localStorage and reload:
```
browser_evaluate → () => {
  localStorage.setItem('token', '<TOKEN>');
  window.location.href = '/';
}
```
Replace `<TOKEN>` with the actual JWT token from Step 2.

3. Wait for the page to load (wait for the page to settle ~2 seconds).

4. Take a snapshot to confirm the user is logged in.

## Step 4: Report

Tell the user:
- Logged in as **[Name]** ([email])
- Browser is open at http://localhost:$VITE_PORT
- They can start testing

Do NOT close the browser — the user needs it for manual testing.
