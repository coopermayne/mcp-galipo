"""
Minimal tool registry for the in-app chat.

Stands in for the FastMCP instance the chat used to read tool metadata from.
`register_tools(registry)` in tools.py decorates functions with
`@registry.tool()`, the same shape FastMCP used, and this records each
function's name, docstring and a JSON schema built from its signature.
"""

import inspect
from dataclasses import dataclass
from typing import Any, Callable

from pydantic import create_model


@dataclass
class Tool:
    name: str
    description: str
    fn: Callable[..., Any]
    parameters: dict[str, Any]


def _inline_refs(node: Any, defs: dict[str, Any]) -> Any:
    """Replace every {"$ref": "#/$defs/X"} with the definition itself."""
    if isinstance(node, dict):
        if "$ref" in node:
            target = defs[node["$ref"].rsplit("/", 1)[-1]]
            merged = {**target, **{k: v for k, v in node.items() if k != "$ref"}}
            return _inline_refs(merged, defs)
        return {k: _inline_refs(v, defs) for k, v in node.items()}
    if isinstance(node, list):
        return [_inline_refs(v, defs) for v in node]
    return node


def _strip_titles(node: Any) -> Any:
    """Drop pydantic's auto-generated "title" keys (FastMCP omitted them too).

    Keys inside a "properties" map are field names, so a field called "title"
    survives.
    """
    if isinstance(node, dict):
        return {
            k: (
                {name: _strip_titles(sub) for name, sub in v.items()}
                if k == "properties" and isinstance(v, dict)
                else _strip_titles(v)
            )
            for k, v in node.items()
            if not (k == "title" and isinstance(v, str))
        }
    if isinstance(node, list):
        return [_strip_titles(v) for v in node]
    return node


def _schema_for(fn: Callable[..., Any]) -> dict[str, Any]:
    """JSON schema for a tool's arguments, skipping the leading context param."""
    fields: dict[str, Any] = {}
    for name, param in inspect.signature(fn).parameters.items():
        if name == "context":
            continue
        default = ... if param.default is inspect.Parameter.empty else param.default
        fields[name] = (param.annotation, default)
    schema = create_model(f"{fn.__name__}_args", **fields).model_json_schema()
    defs = schema.pop("$defs", {})
    return _strip_titles(_inline_refs(schema, defs))


class ToolRegistry:
    def __init__(self) -> None:
        self.tools: dict[str, Tool] = {}

    def tool(self) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
            self.tools[fn.__name__] = Tool(
                name=fn.__name__,
                description=inspect.cleandoc(fn.__doc__ or ""),
                fn=fn,
                parameters=_schema_for(fn),
            )
            return fn

        return decorator
