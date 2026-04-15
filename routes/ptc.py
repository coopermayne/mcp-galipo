"""
PTC (Programmatic Tool Calling) endpoints.

Provides both a standard JSON endpoint and a streaming SSE endpoint
for testing PTC queries.
"""

import asyncio
import json
import logging

from fastapi.responses import JSONResponse, StreamingResponse

import auth
from .common import api_error

logger = logging.getLogger(__name__)


def register_ptc_routes(mcp):
    """Register PTC routes."""

    @mcp.custom_route("/api/v1/ptc/query", methods=["POST"])
    async def api_ptc_query(request):
        """Run a PTC query and return the result."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        user_id = user["id"] if user else None

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "BAD_REQUEST", 400)

        query = body.get("query", "").strip()
        if not query:
            return api_error("query is required", "VALIDATION_ERROR", 400)

        case_context = body.get("case_context")
        container_id = body.get("container_id")

        try:
            from services.ptc import run_ptc_query

            result = await asyncio.to_thread(
                run_ptc_query,
                query=query,
                user_id=user_id,
                case_context=case_context,
                container_id=container_id,
            )
            return JSONResponse(result)
        except Exception as e:
            logger.exception("PTC query failed: %s", e)
            return api_error(f"PTC query failed: {str(e)}", "SERVER_ERROR", 500)

    @mcp.custom_route("/api/v1/ptc/stream", methods=["POST"])
    async def api_ptc_stream(request):
        """Run a PTC query with SSE streaming of each step."""
        if err := auth.require_auth(request):
            return err

        user = auth.get_current_user(request)
        user_id = user["id"] if user else None

        try:
            body = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "BAD_REQUEST", 400)

        query = body.get("query", "").strip()
        if not query:
            return api_error("query is required", "VALIDATION_ERROR", 400)

        case_context = body.get("case_context")
        container_id = body.get("container_id")

        async def event_stream():
            from services.ptc import run_ptc_query_stream
            import queue
            import threading

            q: queue.Queue = queue.Queue()

            def _run():
                try:
                    for event in run_ptc_query_stream(
                        query=query,
                        user_id=user_id,
                        case_context=case_context,
                        container_id=container_id,
                    ):
                        q.put(event)
                except Exception as e:
                    q.put({"type": "error", "message": str(e)})
                finally:
                    q.put(None)  # sentinel

            thread = threading.Thread(target=_run, daemon=True)
            thread.start()

            while True:
                # Poll the queue from the async side
                try:
                    event = await asyncio.to_thread(q.get, timeout=120)
                except Exception:
                    break
                if event is None:
                    break
                yield f"data: {json.dumps(event, default=str)}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
