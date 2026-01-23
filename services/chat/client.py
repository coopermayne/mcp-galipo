"""
Claude API client for the chat feature.

Handles communication with the Anthropic Claude API, including
message sending and tool call extraction.
"""

import os
import anthropic
from typing import Any

from .types import ToolCall


# System prompt for the chat assistant
SYSTEM_PROMPT = """You are an AI assistant for Galipo, a legal case management system for personal injury law firms.

You can help users:
- Query case information, tasks, deadlines, events, contacts
- Create and update notes, tasks, and events
- Search for persons and contacts

Always be helpful and concise. When you need more information to complete a task, ask clarifying questions."""


class ChatClient:
    """Client for interacting with Claude API."""

    def __init__(self):
        """Initialize the Claude client."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = os.environ.get("CHAT_MODEL", "claude-sonnet-4-20250514")
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
        if tools:
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
