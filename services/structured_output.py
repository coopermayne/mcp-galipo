"""
One-shot Claude calls that must return JSON matching a schema.

Uses structured outputs (``output_config.format``), which constrains the reply
to the schema. This replaces the older forced-tool pattern
(``tool_choice={"type": "tool", ...}``), which newer models (Sonnet 5.5,
Opus 5.5) reject with a 400.

Callers get the parsed dict back, or an exception:
- ``ModelRefused`` when the model declines on safety grounds (the reply then
  isn't guaranteed to match the schema, so it's never parsed);
- ``ValueError`` when the reply is cut off by ``max_tokens``.
"""

import copy
import json
import logging

from db.token_usage import record_usage_from_message

logger = logging.getLogger(__name__)


class ModelRefused(Exception):
    """The model declined the request (``stop_reason == "refusal"``)."""

    def __init__(self, category: str | None = None, explanation: str | None = None):
        self.category = category
        self.explanation = explanation
        detail = f" ({category})" if category else ""
        super().__init__(f"The AI model declined this request{detail}.")


def strict_schema(schema: dict) -> dict:
    """Copy of ``schema`` with ``additionalProperties: false`` on every object.

    Structured outputs require it on all objects; our schemas are written
    without it for readability.
    """
    schema = copy.deepcopy(schema)

    def walk(node):
        if isinstance(node, dict):
            types = node.get("type")
            if types == "object" or (isinstance(types, list) and "object" in types):
                node.setdefault("additionalProperties", False)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(schema)
    return schema


def check_refusal(message) -> None:
    """Raise ModelRefused if the response is a safety refusal."""
    if message.stop_reason == "refusal":
        details = getattr(message, "stop_details", None)
        raise ModelRefused(
            getattr(details, "category", None),
            getattr(details, "explanation", None),
        )


def request_json(client, *, model: str, schema: dict, content, system: str | None = None,
                 max_tokens: int = 4096, usage_source: str, usage_type: str) -> dict:
    """Send one user message and return the reply parsed as JSON.

    Token usage is recorded (under ``usage_source`` / ``usage_type``) before
    the reply is checked, so failed calls are still counted.
    """
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": content}],
        "output_config": {"format": {"type": "json_schema", "schema": strict_schema(schema)}},
    }
    if system:
        kwargs["system"] = system
    message = client.messages.create(**kwargs)
    record_usage_from_message(
        source=usage_source, request_type=usage_type, model=model, message=message,
    )

    check_refusal(message)
    if message.stop_reason == "max_tokens":
        raise ValueError("The AI response was cut off before it finished (max_tokens).")
    text = next((b.text for b in message.content if b.type == "text"), None)
    if text is None:
        raise ValueError("The AI response contained no output.")
    return json.loads(text)
