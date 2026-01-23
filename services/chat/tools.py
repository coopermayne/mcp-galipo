"""
Tool definitions for the chat feature - generated from MCP tools.

This module dynamically generates tool definitions from the registered MCP tools,
ensuring the chat feature always has access to the same tools as the MCP server.
"""

from typing import Any
from fastmcp import FastMCP
from tools import register_tools

# Create a local MCP instance to extract tool metadata
# This doesn't start a server, just gives us access to tool definitions
_mcp = FastMCP("chat-tools-meta")
register_tools(_mcp)

# Tools to EXCLUDE from chat (blacklist approach - everything else is available)
BLACKLIST: set[str] = {
    # Add tool names here to hide them from the chat AI
    # Example: "dangerous_tool",
}


def _clean_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Remove internal MCP parameters (like 'context') from a tool schema.

    The MCP framework injects a 'context' parameter for internal use,
    but this should not be exposed to Claude as a tool parameter.

    Args:
        schema: The raw schema from the MCP tool.

    Returns:
        A cleaned schema without internal parameters.
    """
    import copy
    cleaned = copy.deepcopy(schema)

    # Remove 'context' from properties
    if "properties" in cleaned and "context" in cleaned["properties"]:
        del cleaned["properties"]["context"]

    # Remove 'context' from required list
    if "required" in cleaned and "context" in cleaned["required"]:
        cleaned["required"] = [r for r in cleaned["required"] if r != "context"]
        # If required list is now empty, remove it
        if not cleaned["required"]:
            del cleaned["required"]

    # Remove Context definition from $defs
    if "$defs" in cleaned and "Context" in cleaned["$defs"]:
        del cleaned["$defs"]["Context"]
        # If $defs is now empty, remove it
        if not cleaned["$defs"]:
            del cleaned["$defs"]

    return cleaned


def get_tool_definitions() -> list[dict[str, Any]]:
    """Generate tool definitions from MCP tools for Claude API.

    Returns tool definitions in Claude's expected format, automatically
    derived from the registered MCP tools. Internal parameters like
    'context' are filtered out.

    Returns:
        List of tool definitions with name, description, and input_schema.
    """
    definitions = []

    for tool in _mcp._tool_manager._tools.values():
        if tool.name in BLACKLIST:
            continue

        # Clean the schema to remove internal MCP parameters
        cleaned_schema = _clean_schema(tool.parameters)

        definitions.append({
            "name": tool.name,
            "description": tool.description or f"Execute {tool.name}",
            "input_schema": cleaned_schema,
        })

    return definitions


def get_tool_names() -> list[str]:
    """Get list of all available tool names.

    Returns:
        List of tool name strings (excluding blacklisted tools).
    """
    return [tool.name for tool in _mcp._tool_manager._tools.values()
            if tool.name not in BLACKLIST]


def is_tool_available(name: str) -> bool:
    """Check if a tool is available for chat.

    Args:
        name: The tool name to check.

    Returns:
        True if the tool exists and is not blacklisted.
    """
    if name in BLACKLIST:
        return False
    return name in _mcp._tool_manager._tools


# Export the MCP instance for the executor to use
def get_mcp_instance() -> FastMCP:
    """Get the MCP instance with registered tools.

    Used by the executor to call tools directly.
    """
    return _mcp
