"""
PTC agent loop.

Calls the Anthropic Messages API with code_execution + custom tools,
dispatches tool_use blocks to our db layer, and recurses until
Claude returns end_turn.
"""

import json
import logging
import time
from typing import Any, Generator

import anthropic

from config import settings
from .tools import get_tool_definitions
from .dispatch import dispatch_tool
from .system_prompt import build_system_prompt

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 25
MODEL = "claude-sonnet-4-6"


def _get_client() -> anthropic.Anthropic:
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY is required for PTC")
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def run_ptc_query(
    query: str,
    user_id: int | None = None,
    case_context: int | None = None,
    container_id: str | None = None,
) -> dict[str, Any]:
    """Run a PTC query through the agent loop.

    Args:
        query: The user's natural language query.
        user_id: Authenticated user ID (for case-scoped queries).
        case_context: Optional case ID for context.
        container_id: Optional container ID to reuse from a previous turn.

    Returns:
        Dict with keys:
            text: Claude's final text response.
            container_id: Container ID for reuse in follow-up queries.
            tool_calls: List of tool calls that were dispatched.
    """
    client = _get_client()
    system_prompt = build_system_prompt(user_id, case_context)
    tools = get_tool_definitions()
    messages: list[dict[str, Any]] = [{"role": "user", "content": query}]
    tool_call_log: list[dict] = []

    for iteration in range(MAX_ITERATIONS):
        logger.info("PTC iteration %d", iteration + 1)

        kwargs: dict[str, Any] = {
            "model": MODEL,
            "max_tokens": settings.chat_max_tokens,
            "system": system_prompt,
            "tools": tools,
            "messages": messages,
        }
        if container_id:
            kwargs["container"] = container_id

        response = client.messages.create(**kwargs)

        # Track container for reuse (SDK v0.95+ returns Container object with .id)
        if hasattr(response, "container") and response.container:
            c = response.container
            container_id = c.id if hasattr(c, "id") else str(c)

        # Check if we're done
        if response.stop_reason == "end_turn":
            text = _extract_text(response.content)
            return {
                "text": text,
                "container_id": container_id,
                "tool_calls": tool_call_log,
            }

        if response.stop_reason == "tool_use":
            # Append full assistant content to conversation
            # Must serialize content blocks for the messages list
            assistant_content = _serialize_content(response.content)
            messages.append({"role": "assistant", "content": assistant_content})

            # Dispatch each tool_use block
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    logger.info("Dispatching tool: %s(%s)", block.name, block.input)
                    result_str = dispatch_tool(block.name, block.input, user_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str,
                    })
                    tool_call_log.append({
                        "name": block.name,
                        "input": block.input,
                        "result_preview": result_str[:200],
                    })

            # PTC constraint: tool_result message must contain ONLY tool_result blocks
            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop reason
        logger.warning("Unexpected stop_reason: %s", response.stop_reason)
        text = _extract_text(response.content)
        return {
            "text": text or "Unexpected stop reason.",
            "container_id": container_id,
            "tool_calls": tool_call_log,
        }

    # Hit max iterations
    return {
        "text": "Reached maximum iterations without completing.",
        "container_id": container_id,
        "tool_calls": tool_call_log,
    }


def run_ptc_query_stream(
    query: str,
    user_id: int | None = None,
    case_context: int | None = None,
    container_id: str | None = None,
) -> Generator[dict[str, Any], None, None]:
    """Run a PTC query, yielding events as they happen.

    Event types:
        iteration: New agent loop iteration started
        tool_call: A tool was dispatched (name, input)
        tool_result: Tool returned (name, result_preview, duration_ms)
        api_call: Anthropic API call started/completed
        done: Final result (text, container_id, tool_calls)
        error: Something went wrong
    """
    client = _get_client()
    system_prompt = build_system_prompt(user_id, case_context)
    tools = get_tool_definitions()
    messages: list[dict[str, Any]] = [{"role": "user", "content": query}]
    tool_call_log: list[dict] = []
    query_start = time.time()

    for iteration in range(MAX_ITERATIONS):
        yield {"type": "iteration", "iteration": iteration + 1}

        kwargs: dict[str, Any] = {
            "model": MODEL,
            "max_tokens": settings.chat_max_tokens,
            "system": system_prompt,
            "tools": tools,
            "messages": messages,
        }
        if container_id:
            kwargs["container"] = container_id

        api_start = time.time()
        yield {"type": "api_call", "status": "started"}
        response = client.messages.create(**kwargs)
        api_ms = int((time.time() - api_start) * 1000)
        yield {
            "type": "api_call",
            "status": "completed",
            "duration_ms": api_ms,
            "stop_reason": response.stop_reason,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        }

        if hasattr(response, "container") and response.container:
            c = response.container
            container_id = c.id if hasattr(c, "id") else str(c)

        if response.stop_reason == "end_turn":
            text = _extract_text(response.content)
            total_ms = int((time.time() - query_start) * 1000)
            yield {
                "type": "done",
                "text": text,
                "container_id": container_id,
                "tool_calls": tool_call_log,
                "total_ms": total_ms,
            }
            return

        if response.stop_reason == "tool_use":
            assistant_content = _serialize_content(response.content)
            messages.append({"role": "assistant", "content": assistant_content})

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    yield {"type": "tool_call", "name": block.name, "input": block.input}

                    tool_start = time.time()
                    result_str = dispatch_tool(block.name, block.input, user_id)
                    tool_ms = int((time.time() - tool_start) * 1000)

                    result_preview = result_str[:200]
                    yield {
                        "type": "tool_result",
                        "name": block.name,
                        "result_preview": result_preview,
                        "result_length": len(result_str),
                        "duration_ms": tool_ms,
                    }

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str,
                    })
                    tool_call_log.append({
                        "name": block.name,
                        "input": block.input,
                        "result_preview": result_preview,
                    })

            messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop reason
        text = _extract_text(response.content)
        total_ms = int((time.time() - query_start) * 1000)
        yield {
            "type": "done",
            "text": text or "Unexpected stop reason.",
            "container_id": container_id,
            "tool_calls": tool_call_log,
            "total_ms": total_ms,
        }
        return

    total_ms = int((time.time() - query_start) * 1000)
    yield {
        "type": "error",
        "message": "Reached maximum iterations without completing.",
        "container_id": container_id,
        "tool_calls": tool_call_log,
        "total_ms": total_ms,
    }


def _extract_text(content: list) -> str:
    """Extract text from response content blocks."""
    parts = []
    for block in content:
        if hasattr(block, "text"):
            parts.append(block.text)
    return "\n".join(parts)


def _serialize_content(content: list) -> list[dict]:
    """Serialize Anthropic content blocks to dicts for the messages list.

    Uses model_dump() on all blocks for correct serialization of complex
    nested types (especially code_execution_tool_result).
    """
    serialized = []
    for block in content:
        if hasattr(block, "model_dump"):
            serialized.append(block.model_dump())
        else:
            logger.warning("Content block without model_dump: %s", type(block))
    return serialized
