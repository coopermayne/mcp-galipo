# Legal Case Management MCP Server

A minimal proof-of-concept MCP server for testing connectivity with Claude.ai. Built with FastMCP.

**Live URL:** https://mcp-galipo.coopermayne.com

## Available Tools

| Tool | Description |
|------|-------------|
| `list_cases()` | Returns all case names and statuses |
| `get_case(case_name)` | Returns full case details including activities and deadlines |
| `get_deadlines(days_ahead=14)` | Returns upcoming deadlines across all cases |
| `log_activity(case_name, description, activity_type, minutes)` | Adds an activity to a case (in-memory only) |

## Mock Data

The server includes 3 sample cases:
- **Smith v. Johnson** - Civil litigation case
- **Estate of Williams** - Probate matter
- **Acme Corp Acquisition** - M&A transaction

Each case has activities (time entries) and deadlines.

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running the Server

```bash
python main.py
```

This starts the server on `http://0.0.0.0:8000` with SSE transport.

## Connecting to Claude.ai

1. Go to [Claude.ai](https://claude.ai)
2. Open **Settings** → **Integrations** (or look for MCP settings)
3. Add a new MCP server with URL:
   ```
   https://mcp-galipo.coopermayne.com/sse
   ```
4. Save and start a new conversation

## Testing the Connection

Once connected, ask Claude:
- "List all my cases"
- "Show me details for Smith v. Johnson"
- "What deadlines are coming up?"
- "Log 30 minutes of research on the Acme Corp Acquisition case"

## Deployment Notes

The server runs on port 8000. Your reverse proxy (nginx, Caddy, etc.) should:
- Proxy requests to `localhost:8000`
- Support SSE (Server-Sent Events) - ensure no response buffering
- Handle HTTPS termination

Example nginx config snippet:
```nginx
location / {
    proxy_pass http://localhost:8000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
}
```

## Next Steps

This is a proof-of-concept. For production:
- Replace in-memory dict with a real database
- Add authentication
- Add persistent storage for activities
