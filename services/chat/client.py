"""
Claude API client for the chat feature.

Handles communication with the Anthropic Claude API, including
message sending, tool call extraction, and streaming responses.
"""

import os
import anthropic
from typing import Any, Generator

from .types import ToolCall, StreamEventType


# System prompt for the chat assistant
SYSTEM_PROMPT = """You are an AI assistant for Galipo, a legal case management system for personal injury law firms.

You help users query and manage cases, tasks, events, contacts, and notes.

## MANDATORY: Batch all tool calls

You MUST call ALL needed tools in a SINGLE response. Include multiple tool_use blocks together.

<parallel_tools_example>
User: "What are my priorities this week?"

Your response must include BOTH tools at once:
[tool_use: get_tasks]
[tool_use: get_events]

NOT one at a time. NEVER do: call get_tasks → wait → call get_events → wait → respond.
</parallel_tools_example>

<parallel_tools_example>
User: "Show me the Martinez case with upcoming deadlines"

Your response must include BOTH tools at once:
[tool_use: get_case with case_name="Martinez"]
[tool_use: get_events with case_id=...]

If you need a case_id first, ask for clarification rather than making sequential calls.
</parallel_tools_example>

Breaking this rule wastes significant resources. Be concise in responses."""


class ChatClient:
    """Client for interacting with Claude API."""

    def __init__(self):
        """Initialize the Claude client."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        self.client = anthropic.Anthropic(
            api_key=api_key,
            default_headers={"anthropic-beta": "extended-cache-ttl-2025-04-11"}
        )
        self.model = os.environ.get("CHAT_MODEL", "claude-haiku-4-5")
        self.max_tokens = int(os.environ.get("CHAT_MAX_TOKENS", "4096"))

    def send_message(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        system_prompt: str | None = None
    ) -> dict[str, Any]:
        """
        Send a message to Claude and return the response.

        Args:
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of tool definitions in Claude API format
            system_prompt: Optional system prompt (uses default if not provided)

        Returns:
            Dict with:
                - content: The text response from Claude (may be empty if only tool calls)
                - tool_calls: List of ToolCall objects if Claude wants to use tools
                - stop_reason: Why Claude stopped generating ('end_turn', 'tool_use', etc.)
        """
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": system_prompt or SYSTEM_PROMPT,
            "messages": messages,
        }

        # Only include tools if provided and non-empty
        # Add 1-hour cache control to last tool to cache all tool definitions
        if tools:
            tools = list(tools)  # Copy to avoid mutating original
            tools[-1] = {
                **tools[-1],
                "cache_control": {"type": "ephemeral", "ttl": "1h"}
            }
            kwargs["tools"] = tools

        response = self.client.messages.create(**kwargs)

        # Extract text content and tool calls from response
        text_content = ""
        tool_calls: list[ToolCall] = []

        for block in response.content:
            if block.type == "text":
                text_content += block.text
            elif block.type == "tool_use":
                tool_calls.append(ToolCall(
                    id=block.id,
                    name=block.name,
                    arguments=block.input if isinstance(block.input, dict) else {}
                ))

        return {
            "content": text_content,
            "tool_calls": tool_calls,
            "stop_reason": response.stop_reason
        }

    def stream_message(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        system_prompt: str | None = None
    ) -> Generator[dict[str, Any], None, None]:
        """
        Stream a response from Claude, yielding events as they arrive.

        Args:
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of tool definitions in Claude API format
            system_prompt: Optional system prompt (uses default if not provided)

        Yields:
            Dict events with 'type' and associated data:
                - {"type": "text", "content": "partial text..."}
                - {"type": "tool_start", "id": "...", "name": "...", "arguments": {...}}
                - {"type": "content_block_stop"} - signals end of a content block
                - {"type": "message_stop", "stop_reason": "..."} - signals end of message
        """
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": system_prompt or SYSTEM_PROMPT,
            "messages": messages,
        }

        # Only include tools if provided and non-empty
        # Add 1-hour cache control to last tool to cache all tool definitions
        if tools:
            tools = list(tools)  # Copy to avoid mutating original
            tools[-1] = {
                **tools[-1],
                "cache_control": {"type": "ephemeral", "ttl": "1h"}
            }
            kwargs["tools"] = tools

        # Track current tool being built (for accumulating JSON input)
        current_tool_id: str | None = None
        current_tool_name: str | None = None
        current_tool_input_json: str = ""

        with self.client.messages.stream(**kwargs) as stream:
            for event in stream:
                event_type = event.type

                if event_type == "content_block_start":
                    # Check if this is a tool_use block
                    content_block = event.content_block
                    if content_block.type == "tool_use":
                        current_tool_id = content_block.id
                        current_tool_name = content_block.name
                        current_tool_input_json = ""
                        # Emit tool_start event
                        yield {
                            "type": StreamEventType.TOOL_USE.value,
                            "subtype": "start",
                            "id": current_tool_id,
                            "name": current_tool_name,
                        }

                elif event_type == "content_block_delta":
                    delta = event.delta
                    if delta.type == "text_delta":
                        # Emit text delta
                        yield {
                            "type": StreamEventType.TEXT.value,
                            "content": delta.text,
                        }
                    elif delta.type == "input_json_delta":
                        # Accumulate tool input JSON
                        current_tool_input_json += delta.partial_json

                elif event_type == "content_block_stop":
                    # If we were building a tool, emit the complete tool call
                    if current_tool_id and current_tool_name:
                        import json
                        try:
                            arguments = json.loads(current_tool_input_json) if current_tool_input_json else {}
                        except json.JSONDecodeError:
                            arguments = {}

                        yield {
                            "type": StreamEventType.TOOL_USE.value,
                            "subtype": "done",
                            "id": current_tool_id,
                            "name": current_tool_name,
                            "arguments": arguments,
                        }

                        # Reset tool tracking
                        current_tool_id = None
                        current_tool_name = None
                        current_tool_input_json = ""

                elif event_type == "message_stop":
                    # Get the final message to extract stop_reason and usage
                    final_message = stream.get_final_message()

                    # Extract usage data
                    usage = None
                    if final_message and hasattr(final_message, 'usage'):
                        usage = {
                            "input_tokens": final_message.usage.input_tokens,
                            "output_tokens": final_message.usage.output_tokens,
                            "cache_creation_input_tokens": getattr(final_message.usage, 'cache_creation_input_tokens', 0) or 0,
                            "cache_read_input_tokens": getattr(final_message.usage, 'cache_read_input_tokens', 0) or 0,
                        }

                    yield {
                        "type": "message_stop",
                        "stop_reason": final_message.stop_reason if final_message else "end_turn",
                        "usage": usage,
                    }
