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
    """
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
