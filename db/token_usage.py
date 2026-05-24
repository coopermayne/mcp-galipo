"""Append-only token-usage logging for Claude API calls.

`record_usage()` writes one row per API request to `token_usage_log`. It is
intentionally best-effort: any failure is swallowed and logged at WARNING, so a
logging problem can never break a chat response or an extraction. Keep the
single INSERT off the request's critical path (e.g. after the response has been
flushed to the client, or via ``asyncio.to_thread`` in async code).

Pricing below is USD per 1M tokens, keyed by a substring of the model id.
Update it when Anthropic pricing changes — existing rows keep the cost snapshot
that was computed at request time, so history stays accurate.
"""

import logging
from typing import Any, Optional

from sqlalchemy import insert

from db.session import SessionLocal
from models import TokenUsageLog

_logger = logging.getLogger("db.token_usage")

# USD per 1,000,000 tokens. Matched by substring against the model id.
_PRICING = {
    "haiku": {"input": 0.80, "output": 4.00, "cache_write": 1.00, "cache_read": 0.08},
    "sonnet": {"input": 3.00, "output": 15.00, "cache_write": 3.75, "cache_read": 0.30},
    "opus": {"input": 15.00, "output": 75.00, "cache_write": 18.75, "cache_read": 1.50},
}


def _estimate_cost_usd(
    model: Optional[str],
    input_tokens: int,
    output_tokens: int,
    cache_creation_input_tokens: int,
    cache_read_input_tokens: int,
) -> Optional[float]:
    """Best-effort cost snapshot. Returns None if the model isn't in _PRICING."""
    m = (model or "").lower()
    rates = next((r for key, r in _PRICING.items() if key in m), None)
    if not rates:
        return None
    return round(
        (input_tokens / 1_000_000) * rates["input"]
        + (output_tokens / 1_000_000) * rates["output"]
        + (cache_creation_input_tokens / 1_000_000) * rates["cache_write"]
        + (cache_read_input_tokens / 1_000_000) * rates["cache_read"],
        6,
    )


def record_usage(
    *,
    source: str,
    request_type: Optional[str] = None,
    model: Optional[str] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_creation_input_tokens: int = 0,
    cache_read_input_tokens: int = 0,
    case_id: Optional[int] = None,
    username: Optional[str] = None,
    conversation_id: Optional[str] = None,
    duration_ms: Optional[int] = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    """Persist one token-usage record. Never raises."""
    try:
        input_tokens = input_tokens or 0
        output_tokens = output_tokens or 0
        cache_creation_input_tokens = cache_creation_input_tokens or 0
        cache_read_input_tokens = cache_read_input_tokens or 0
        cost = _estimate_cost_usd(
            model,
            input_tokens,
            output_tokens,
            cache_creation_input_tokens,
            cache_read_input_tokens,
        )
        with SessionLocal() as session:
            session.execute(
                insert(TokenUsageLog).values(
                    source=source,
                    request_type=request_type,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cache_creation_input_tokens=cache_creation_input_tokens,
                    cache_read_input_tokens=cache_read_input_tokens,
                    estimated_cost_usd=cost,
                    case_id=case_id if isinstance(case_id, int) else None,
                    username=username,
                    conversation_id=conversation_id,
                    duration_ms=duration_ms,
                    meta=meta,
                )
            )
            session.commit()
    except Exception:
        _logger.warning("Failed to record token usage (source=%s)", source, exc_info=True)


def record_usage_from_message(
    *,
    source: str,
    model: Optional[str] = None,
    request_type: Optional[str] = None,
    message: Any,
    **kwargs: Any,
) -> None:
    """Pull `.usage` off a non-streaming Anthropic message and record it.

    Extra keyword args (case_id, username, duration_ms, meta, ...) pass through
    to record_usage. Never raises.
    """
    usage = getattr(message, "usage", None)
    if usage is None:
        return
    record_usage(
        source=source,
        request_type=request_type,
        model=model,
        input_tokens=getattr(usage, "input_tokens", 0) or 0,
        output_tokens=getattr(usage, "output_tokens", 0) or 0,
        cache_creation_input_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
        cache_read_input_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
        **kwargs,
    )
