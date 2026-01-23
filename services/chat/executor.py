"""
Tool executor for the chat feature.

This module executes tools by calling the MCP tool functions directly,
ensuring consistent behavior between the MCP server and chat feature.
"""

import json
import logging
import time
from typing import Any

from services.chat.types import ToolCall, ToolResult
from services.chat.tools import get_mcp_instance, BLACKLIST

logger = logging.getLogger(__name__)

# Maximum characters for result content before truncation
MAX_RESULT_CHARS = 4000

# Get the MCP instance with all registered tools
_mcp = get_mcp_instance()


class ChatContext:
    """Minimal context for calling MCP tools from the chat service.

    MCP tools expect a Context object for logging. This provides a compatible
    interface that logs to Python's standard logging instead of MCP's system.
    """

    def info(self, msg: str) -> None:
        logger.info(f"[MCP Tool] {msg}")

    def debug(self, msg: str) -> None:
        logger.debug(f"[MCP Tool] {msg}")

    def warning(self, msg: str) -> None:
        logger.warning(f"[MCP Tool] {msg}")

    def error(self, msg: str) -> None:
        logger.error(f"[MCP Tool] {msg}")

    def report_progress(self, progress: float, total: float | None = None) -> None:
        """Report progress (no-op for chat context)."""
        pass

    async def read_resource(self, uri: str) -> Any:
        """Read a resource (not supported in chat context)."""
        raise NotImplementedError("Resource reading not supported in chat context")


# Shared context instance
_context = ChatContext()


def _truncate_result(result: Any, tool_name: str) -> tuple[str, bool]:
    """Truncate large results intelligently.

    Args:
        result: The result to potentially truncate
        tool_name: Name of the tool (for context-aware truncation)

    Returns:
        Tuple of (json_string, was_truncated)
    """
    json_str = json.dumps(result, default=str)

    if len(json_str) <= MAX_RESULT_CHARS:
        return json_str, False

    # Handle list results - show first N items + count of remaining
    if isinstance(result, list):
        total_count = len(result)
        for take in [10, 5, 3, 1]:
            truncated = result[:take]
            truncated_json = json.dumps({
                "items": truncated,
                "truncated": True,
                "showing": take,
                "total": total_count,
                "note": f"Showing first {take} of {total_count} items"
            }, default=str)
            if len(truncated_json) <= MAX_RESULT_CHARS:
                return truncated_json, True
        return json.dumps({
            "truncated": True,
            "total": total_count,
            "note": f"Result too large. Contains {total_count} items."
        }), True

    # Handle dict results with list values
    if isinstance(result, dict):
        for key in ['items', 'data', 'cases', 'tasks', 'events', 'notes', 'persons']:
            if key in result and isinstance(result[key], list):
                total_count = len(result[key])
                for take in [10, 5, 3, 1]:
                    truncated_result = {**result, key: result[key][:take]}
                    truncated_result['truncated'] = True
                    truncated_result['showing'] = take
                    truncated_result['total_items'] = total_count
                    truncated_json = json.dumps(truncated_result, default=str)
                    if len(truncated_json) <= MAX_RESULT_CHARS:
                        return truncated_json, True

    # Fallback: simple character truncation
    truncated_json = json_str[:MAX_RESULT_CHARS - 100]
    return json.dumps({
        "partial_result": truncated_json,
        "truncated": True,
        "note": "Result truncated due to size"
    }), True


def _generate_summary(result: Any, tool_name: str, args: dict[str, Any]) -> str:
    """Generate a human-readable summary of the tool result.

    Args:
        result: The tool execution result
        tool_name: Name of the tool that was executed
        args: Arguments passed to the tool

    Returns:
        Human-readable summary string
    """
    # Handle errors
    if isinstance(result, dict):
        if 'error' in result:
            return f"Error: {result['error']}"
        if result.get('error_type'):
            return f"Error: {result.get('message', 'Unknown error')}"

    # Success with message
    if isinstance(result, dict) and result.get('success') and result.get('message'):
        return result['message']

    # Count-based summaries for common patterns
    if isinstance(result, dict):
        for key in ['cases', 'tasks', 'events', 'notes', 'persons', 'items']:
            if key in result and isinstance(result[key], list):
                count = len(result[key])
                total = result.get('total', count)
                return f"Found {count} {key}" + (f" (total: {total})" if total != count else "")

    if isinstance(result, list):
        return f"Retrieved {len(result)} items"

    # Single item retrieval
    if isinstance(result, dict):
        if 'case_name' in result:
            return f"Retrieved case: {result['case_name']}"
        if 'name' in result and 'person_type' in result:
            return f"Retrieved person: {result['name']}"
        if 'description' in result and 'case_id' in result:
            desc = result['description'][:40]
            return f"Retrieved: {desc}..."

    return "Operation completed"


def execute_tool(tool_call: ToolCall) -> ToolResult:
    """Execute a tool by calling the MCP tool function directly.

    Args:
        tool_call: The tool call to execute, containing name, id, and arguments.

    Returns:
        ToolResult with the execution result or error message.
    """
    logger.info(f"Executing tool: {tool_call.name} with args: {tool_call.arguments}")

    start_time = time.time()

    # Check if tool is blacklisted
    if tool_call.name in BLACKLIST:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.warning(f"Blacklisted tool requested: {tool_call.name}")
        return ToolResult(
            tool_use_id=tool_call.id,
            content=f"Tool '{tool_call.name}' is not available",
            is_error=True,
            duration_ms=duration_ms,
            summary=f"Error: Tool '{tool_call.name}' is not available"
        )

    # Get the tool from MCP
    tool = _mcp._tool_manager._tools.get(tool_call.name)
    if not tool:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.warning(f"Unknown tool requested: {tool_call.name}")
        return ToolResult(
            tool_use_id=tool_call.id,
            content=f"Unknown tool: {tool_call.name}",
            is_error=True,
            duration_ms=duration_ms,
            summary=f"Error: Unknown tool '{tool_call.name}'"
        )

    try:
        # Call the MCP tool function with our chat context
        # MCP tools expect (context, **kwargs) signature
        result = tool.fn(_context, **tool_call.arguments)

        duration_ms = int((time.time() - start_time) * 1000)

        # Check if result indicates an error
        is_error = False
        if isinstance(result, dict):
            is_error = result.get('error_type') is not None or 'error' in result

        # Generate human-readable summary
        summary = _generate_summary(result, tool_call.name, tool_call.arguments)

        # Truncate large results
        content, was_truncated = _truncate_result(result, tool_call.name)

        if was_truncated:
            logger.info(f"Tool {tool_call.name} result truncated")
            summary += " (truncated)"

        logger.info(f"Tool {tool_call.name} executed in {duration_ms}ms: {summary}")

        return ToolResult(
            tool_use_id=tool_call.id,
            content=content,
            is_error=is_error,
            duration_ms=duration_ms,
            summary=summary
        )

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.exception(f"Error executing tool {tool_call.name}: {e}")
        return ToolResult(
            tool_use_id=tool_call.id,
            content=f"Error executing {tool_call.name}: {str(e)}",
            is_error=True,
            duration_ms=duration_ms,
            summary=f"Error: {str(e)}"
        )


def get_available_tools() -> list[str]:
    """Get list of all available tool names.

    Returns:
        List of tool name strings (excluding blacklisted tools).
    """
    return [name for name in _mcp._tool_manager._tools.keys()
            if name not in BLACKLIST]
