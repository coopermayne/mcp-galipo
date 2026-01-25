"""
Chat service package.

Provides Claude AI chat integration for the Galipo legal case management system.
"""

from .types import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ToolCall,
    ToolResult,
    MessageRole,
    StreamEvent,
    StreamEventType,
)
from .client import ChatClient, SYSTEM_PROMPT
from .tools import get_tool_definitions, get_tool_names
from .executor import execute_tool, get_available_tools
from .debug import (
    log_request,
    log_response,
    log_tool_execution,
    log_conversation_summary,
    get_tool_summary,
    clear_log,
    DEBUG_ENABLED,
)

__all__ = [
    # Types
    "ChatMessage",
    "ChatRequest",
    "ChatResponse",
    "ToolCall",
    "ToolResult",
    "MessageRole",
    "StreamEvent",
    "StreamEventType",
    # Client
    "ChatClient",
    "SYSTEM_PROMPT",
    # Tools
    "get_tool_definitions",
    "get_tool_names",
    # Executor
    "execute_tool",
    "get_available_tools",
    # Debug
    "log_request",
    "log_response",
    "log_tool_execution",
    "log_conversation_summary",
    "get_tool_summary",
    "clear_log",
    "DEBUG_ENABLED",
]
