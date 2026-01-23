"""
Shared types for the chat feature.

This module defines the contract between:
- Chat client (Claude API integration)
- Tool executor (runs MCP tools)
- Chat routes (REST API endpoints)
- Frontend (TypeScript types mirror these)
"""

from dataclasses import dataclass, field
from typing import Optional, Any
from enum import Enum


class MessageRole(str, Enum):
    """Role of a message in the conversation."""
    USER = "user"
    ASSISTANT = "assistant"


@dataclass
class ToolCall:
    """A tool call requested by Claude."""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ToolResult:
    """Result of executing a tool."""
    tool_use_id: str
    content: str  # JSON-serialized result or error message
    is_error: bool = False
    duration_ms: int = 0  # Execution time in milliseconds
    summary: str = ""  # Human-readable summary of the result


@dataclass
class ChatMessage:
    """A message in the conversation history."""
    role: MessageRole
    content: str
    tool_calls: list[ToolCall] | None = None
    tool_results: list[ToolResult] | None = None


@dataclass
class ChatRequest:
    """Request to send a message to the chat API."""
    message: str
    conversation_id: Optional[str] = None
    case_context: Optional[int] = None  # case_id if user is viewing a case


@dataclass
class ChatResponse:
    """Response from the chat API."""
    content: str
    conversation_id: str
    tool_calls: list[ToolCall] | None = None
    finished: bool = True


# SSE Event types for streaming (Phase 2)
class StreamEventType(str, Enum):
    """Types of events in the SSE stream."""
    TEXT = "text"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    DONE = "done"
    ERROR = "error"


@dataclass
class StreamEvent:
    """An event in the SSE stream."""
    type: StreamEventType
    content: Optional[str] = None
    tool_call: Optional[ToolCall] = None
    tool_result: Optional[ToolResult] = None
    error: Optional[str] = None
