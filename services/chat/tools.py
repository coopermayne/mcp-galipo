"""
Tool definitions for the chat feature.

Tools are defined in tools.py and registered on a local ToolRegistry; this
module turns them into Claude API tool definitions, filtered by chat mode.
"""

from typing import Any
from tools import register_tools
from .modes import get_mode_tools
from .registry import ToolRegistry

registry = ToolRegistry()
register_tools(registry)


def get_tool_definitions(mode: str | None = None) -> list[dict[str, Any]]:
    """Claude API tool definitions for a chat mode.

    Args:
        mode: Chat mode. A mode with an allowlist gets only those tools;
              no mode (or an unknown one) gets every registered tool.

    Returns:
        List of tool definitions with name, description, and input_schema.
    """
    allowed = get_mode_tools(mode)
    return [
        {
            "name": tool.name,
            "description": tool.description or f"Execute {tool.name}",
            "input_schema": tool.parameters,
        }
        for tool in registry.tools.values()
        if not allowed or tool.name in allowed
    ]


def get_tool_names(mode: str | None = None) -> list[str]:
    """Names of the tools available in a chat mode."""
    return [t["name"] for t in get_tool_definitions(mode)]


def is_tool_available(name: str) -> bool:
    """True if a tool with this name is registered."""
    return name in registry.tools
