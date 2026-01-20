# mcp-galipo

Minimal scaffold for an MCP server using FastMCP.

## What’s included

- `requirements.txt` — pinned packages for initial development.
- `main.py` — entrypoint with a simple `hello_world_tool` function (no server implementation yet).
- `README.md` — this file with setup and next steps.

## Prerequisites

- Python 3.10+ recommended
- git (optional)

## Quickstart

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate   # macOS / Linux
.venv\Scripts\activate      # Windows (PowerShell)
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the minimal local smoke test:

```bash
python main.py
```

You should see a small JSON payload like:

```json
{
  "message": "Hello, world!"
}
```

## Next steps (suggested)

- Integrate FastMCP server and register `hello_world_tool` as a Tool according to FastMCP's API.
- Add configuration (CLI or env-based), logging, and a run command (e.g., using `uvicorn` or FastMCP's runner).
- Add tests and CI (GitHub Actions) for basic checks.
- Add project metadata (pyproject.toml) and a license.

## Notes

This repository currently contains only the basic structure and an example tool function. No production-ready server logic is implemented yet.
