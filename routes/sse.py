"""
SSE (Server-Sent Events) broadcast hub for real-time updates.

Lightweight in-memory fan-out: one asyncio.Queue per connected client.
No Redis needed — works with single-worker deploys.
"""

import asyncio
import json
import logging
import time

logger = logging.getLogger(__name__)

# Connected SSE clients — each gets its own queue
_clients: set[asyncio.Queue] = set()


def broadcast(event: dict) -> None:
    """
    Put an event dict on every connected client's queue.
    Fire-and-forget — dropped if a client's queue is full.
    """
    if not _clients:
        return
    msg = json.dumps(event)
    for q in _clients.copy():
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            logger.warning("SSE client queue full, dropping event")


async def sse_generator(queue: asyncio.Queue):
    """
    Yield SSE-formatted lines from a client queue.
    Sends a heartbeat comment every 15 seconds to keep the connection alive.
    The initial comment fires immediately so EventSource.onopen triggers
    without waiting for the first heartbeat (important when behind a proxy).
    """
    # Immediate comment so the browser sees data and fires onopen
    yield f": connected {int(time.time())}\n\n"
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {msg}\n\n"
            except asyncio.TimeoutError:
                # Heartbeat — SSE comment line keeps connection alive
                yield f": heartbeat {int(time.time())}\n\n"
    except asyncio.CancelledError:
        pass


def add_client() -> asyncio.Queue:
    """Register a new SSE client and return its queue."""
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    _clients.add(q)
    logger.info("SSE client connected (%d total)", len(_clients))
    return q


def remove_client(queue: asyncio.Queue) -> None:
    """Unregister an SSE client."""
    _clients.discard(queue)
    logger.info("SSE client disconnected (%d remaining)", len(_clients))


def register_sse_routes(mcp):
    """Register the generic SSE stream endpoint."""
    import auth
    from fastapi.responses import JSONResponse, StreamingResponse

    @mcp.custom_route("/api/v1/stream", methods=["GET"])
    async def api_event_stream(request):
        """SSE stream for real-time updates across the whole app.

        Auth via ?token= query param since EventSource can't set headers.
        """
        token = request.query_params.get("token")
        if not token:
            token = auth.get_token_from_request(request)
        if not token or not auth.validate_session(token):
            return JSONResponse(
                {"error": "Authentication required"}, status_code=401
            )

        queue = add_client()

        async def event_stream():
            try:
                async for chunk in sse_generator(queue):
                    yield chunk
            finally:
                remove_client(queue)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
