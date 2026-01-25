"""
Debug logging for chat requests and responses.

Logs full prompts, responses, and tool usage to a JSONL file for analysis.

Enable with CHAT_DEBUG=true environment variable (dev only).
Automatically disabled in production (Railway, cloud DBs, etc).
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any


def _is_production() -> bool:
    """Detect if running in production environment."""
    # Railway sets this
    if os.environ.get("RAILWAY_ENVIRONMENT"):
        return True
    # Explicit production flag
    if os.environ.get("ENV", "").lower() == "production":
        return True
    # Cloud database URLs (Railway, Supabase, Neon, etc.)
    db_url = os.environ.get("DATABASE_URL", "")
    cloud_hosts = ["railway.app", "supabase.co", "neon.tech", "aws.com", "azure.com"]
    if any(host in db_url for host in cloud_hosts):
        return True
    return False


# Configuration - disabled by default, never enabled in production
_explicit_enable = os.environ.get("CHAT_DEBUG", "").lower() in ("true", "1", "yes")
DEBUG_ENABLED = _explicit_enable and not _is_production()

LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "chat"
LOG_FILE = LOG_DIR / "debug.jsonl"


def _ensure_log_dir():
    """Create log directory if it doesn't exist."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars per token for English)."""
    if not text:
        return 0
    return len(text) // 4


def _estimate_message_tokens(messages: list[dict]) -> int:
    """Estimate tokens in a message list."""
    total = 0
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            total += _estimate_tokens(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        total += _estimate_tokens(block.get("text", ""))
                    elif block.get("type") == "tool_use":
                        total += _estimate_tokens(json.dumps(block.get("input", {})))
                    elif block.get("type") == "tool_result":
                        total += _estimate_tokens(block.get("content", ""))
    return total


def _estimate_tools_tokens(tools: list[dict]) -> int:
    """Estimate tokens in tool definitions."""
    if not tools:
        return 0
    return _estimate_tokens(json.dumps(tools))


def log_request(
    conversation_id: str,
    system_prompt: str,
    messages: list[dict],
    tools: list[dict] | None,
    case_context: int | None = None,
):
    """Log a chat request before sending to Claude."""
    if not DEBUG_ENABLED:
        return

    _ensure_log_dir()

    # Token estimates
    system_tokens = _estimate_tokens(system_prompt)
    message_tokens = _estimate_message_tokens(messages)
    tools_tokens = _estimate_tools_tokens(tools or [])
    total_tokens = system_tokens + message_tokens + tools_tokens

    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "request",
        "conversation_id": conversation_id,
        "case_context": case_context,
        "token_estimates": {
            "system_prompt": system_tokens,
            "messages": message_tokens,
            "tools": tools_tokens,
            "total": total_tokens,
        },
        "tool_count": len(tools) if tools else 0,
        "message_count": len(messages),
        "system_prompt": system_prompt,
        "messages": messages,
        "tools": tools,
    }

    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def log_response(
    conversation_id: str,
    content: str,
    tool_calls: list[dict] | None,
    stop_reason: str,
    duration_ms: int | None = None,
):
    """Log a response from Claude."""
    if not DEBUG_ENABLED:
        return

    _ensure_log_dir()

    response_tokens = _estimate_tokens(content)
    if tool_calls:
        response_tokens += _estimate_tokens(json.dumps(tool_calls))

    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "response",
        "conversation_id": conversation_id,
        "token_estimates": {
            "response": response_tokens,
        },
        "stop_reason": stop_reason,
        "duration_ms": duration_ms,
        "content": content,
        "tool_calls": tool_calls,
    }

    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def log_tool_execution(
    conversation_id: str,
    tool_name: str,
    tool_id: str,
    arguments: dict,
    result: str,
    is_error: bool,
    duration_ms: int,
):
    """Log a tool execution."""
    if not DEBUG_ENABLED:
        return

    _ensure_log_dir()

    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "tool_execution",
        "conversation_id": conversation_id,
        "tool_name": tool_name,
        "tool_id": tool_id,
        "arguments": arguments,
        "result_length": len(result),
        "result_tokens": _estimate_tokens(result),
        "is_error": is_error,
        "duration_ms": duration_ms,
        "result": result[:2000] + "..." if len(result) > 2000 else result,  # Truncate large results
    }

    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def log_conversation_summary(
    conversation_id: str,
    total_requests: int,
    total_tool_calls: int,
    total_duration_ms: int,
):
    """Log a summary when conversation ends."""
    if not DEBUG_ENABLED:
        return

    _ensure_log_dir()

    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "conversation_summary",
        "conversation_id": conversation_id,
        "total_requests": total_requests,
        "total_tool_calls": total_tool_calls,
        "total_duration_ms": total_duration_ms,
    }

    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def get_tool_summary() -> dict:
    """
    Analyze the debug log and return a summary of tool usage.

    Returns dict with:
    - tool_counts: how many times each tool was called
    - avg_result_tokens: average result size per tool
    - total_tool_tokens: estimated tokens used by tool definitions
    """
    if not LOG_FILE.exists():
        return {"error": "No debug log found. Enable with CHAT_DEBUG=true"}

    tool_counts: dict[str, int] = {}
    tool_result_tokens: dict[str, list[int]] = {}
    tool_definition_tokens = 0

    with open(LOG_FILE) as f:
        for line in f:
            try:
                entry = json.loads(line)

                if entry["type"] == "request" and entry.get("tools"):
                    tool_definition_tokens = entry["token_estimates"]["tools"]

                if entry["type"] == "tool_execution":
                    name = entry["tool_name"]
                    tool_counts[name] = tool_counts.get(name, 0) + 1

                    if name not in tool_result_tokens:
                        tool_result_tokens[name] = []
                    tool_result_tokens[name].append(entry["result_tokens"])

            except json.JSONDecodeError:
                continue

    # Calculate averages
    avg_result_tokens = {}
    for name, tokens_list in tool_result_tokens.items():
        avg_result_tokens[name] = sum(tokens_list) // len(tokens_list) if tokens_list else 0

    return {
        "tool_counts": dict(sorted(tool_counts.items(), key=lambda x: -x[1])),
        "avg_result_tokens": avg_result_tokens,
        "tool_definition_tokens": tool_definition_tokens,
        "total_tool_calls": sum(tool_counts.values()),
    }


def clear_log():
    """Clear the debug log file."""
    if LOG_FILE.exists():
        LOG_FILE.unlink()
