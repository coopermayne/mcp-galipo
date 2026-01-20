"""
Main entrypoint for the MCP server (placeholder).

This file contains a minimal "hello world" tool function. No FastMCP server
implementation is included yet — adapt the `hello_world_tool` to FastMCP's
Tool/handler API when you integrate the framework.
"""

from typing import Dict

def hello_world_tool(name: str = "world") -> Dict[str, str]:
    """
    Minimal example tool for FastMCP integration.

    Args:
        name: Optional name to include in the greeting.

    Returns:
        A small dict payload (replace with the actual Tool return type when integrating).
    """
    return {"message": f"Hello, {name}!"}


if __name__ == "__main__":
    # Simple local smoke test for the tool.
    import json

    print(json.dumps(hello_world_tool(), indent=2))
