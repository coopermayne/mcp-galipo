"""
Chat API routes.

Handles chat interactions with Claude AI, including tool execution loop.
"""

import uuid
import logging
from typing import Any
from pathlib import Path
from fastapi.responses import JSONResponse

import auth
from .common import api_error

# Set up logging
_log_file = Path(__file__).parent.parent / "logs" / "chat_debug.log"
_log_file.parent.mkdir(exist_ok=True)
_logger = logging.getLogger("routes.chat")
_file_handler = logging.FileHandler(_log_file)
_file_handler.setLevel(logging.DEBUG)
_file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
_logger.addHandler(_file_handler)
_logger.setLevel(logging.DEBUG)
from services.chat import (
    ChatClient,
    ToolCall,
    ToolResult,
    get_tool_definitions,
    execute_tool,
)


# In-memory conversation storage
# Key: conversation_id, Value: list of messages in Claude API format
_conversations: dict[str, list[dict[str, Any]]] = {}


def _tool_calls_to_content_blocks(tool_calls: list[ToolCall]) -> list[dict[str, Any]]:
    """Convert ToolCall objects to Claude API content blocks."""
    return [
        {
            "type": "tool_use",
            "id": tc.id,
            "name": tc.name,
            "input": tc.arguments
        }
        for tc in tool_calls
    ]


def _tool_results_to_content_blocks(results: list[ToolResult]) -> list[dict[str, Any]]:
    """Convert ToolResult objects to Claude API content blocks."""
    return [
        {
            "type": "tool_result",
            "tool_use_id": r.tool_use_id,
            "content": r.content,
            "is_error": r.is_error
        }
        for r in results
    ]


def register_chat_routes(mcp):
    """Register chat routes."""
    _logger.info("register_chat_routes called - registering POST /api/v1/chat")

    # Debug endpoint - no auth required, just for testing
    @mcp.custom_route("/api/v1/chat/debug", methods=["GET"])
    async def api_chat_debug(request):
        _logger.info("Debug endpoint hit!")
        return JSONResponse({"status": "ok", "message": "Chat routes are registered!"})

    @mcp.custom_route("/api/v1/chat", methods=["POST"])
    async def api_chat(request):
        _logger.info(f"=== Chat endpoint hit! Method: {request.method}, URL: {request.url} ===")
        """
        Send a message to the chat assistant.

        Request body:
            - message: str - The user's message
            - conversation_id: str | None - Optional conversation ID for continuing a conversation
            - case_context: int | None - Optional case ID if user is viewing a case

        Response:
            - content: str - The assistant's response
            - conversation_id: str - The conversation ID (new or existing)
            - tool_calls: list | None - Any tool calls made (for debugging/transparency)
            - finished: bool - Whether the response is complete
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "INVALID_REQUEST", 400)

        message = data.get("message")
        if not message or not isinstance(message, str):
            return api_error("Message is required", "MISSING_FIELD", 400)

        conversation_id = data.get("conversation_id")
        case_context = data.get("case_context")

        # Generate new conversation ID if not provided
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            _conversations[conversation_id] = []

        # Get or initialize conversation history
        if conversation_id not in _conversations:
            _conversations[conversation_id] = []

        messages = _conversations[conversation_id]

        # Add user message to history
        messages.append({
            "role": "user",
            "content": message
        })

        # Initialize chat client
        try:
            client = ChatClient()
        except ValueError as e:
            return api_error(str(e), "CONFIG_ERROR", 500)

        # Get tool definitions
        tools = get_tool_definitions()

        # Build system prompt with current date and optional case context
        from datetime import datetime
        current_date = datetime.now().strftime("%A, %B %d, %Y")
        current_time = datetime.now().strftime("%I:%M %p")

        system_prompt = f"""You are an AI assistant for Galipo, a legal case management system for personal injury law firms.

Current date: {current_date}
Current time: {current_time}

You can help users:
- Query case information, tasks, deadlines, events, contacts
- Create and update notes, tasks, and events
- Search for persons and contacts

When creating or updating dates, always use the current year ({datetime.now().year}) unless the user explicitly specifies a different year.

Always be helpful and concise. When you need more information to complete a task, ask clarifying questions."""

        if case_context:
            system_prompt += f"""

The user is currently viewing case ID: {case_context}. When they ask about "this case" or "the case", they mean case ID {case_context}."""

        # Track all tool calls for the response
        all_tool_calls: list[dict[str, Any]] = []

        # Conversation loop - continue until no more tool calls
        max_iterations = 10  # Safety limit
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            try:
                response = client.send_message(
                    messages=messages,
                    tools=tools if tools else None,
                    system_prompt=system_prompt
                )
            except Exception as e:
                # Remove the user message we added since the request failed
                messages.pop()
                return api_error(f"Failed to communicate with Claude: {str(e)}", "API_ERROR", 500)

            tool_calls = response.get("tool_calls", [])
            content = response.get("content", "")
            stop_reason = response.get("stop_reason")

            if tool_calls:
                # Add assistant message with tool calls to history
                assistant_content: list[dict[str, Any]] = []
                if content:
                    assistant_content.append({"type": "text", "text": content})
                assistant_content.extend(_tool_calls_to_content_blocks(tool_calls))

                messages.append({
                    "role": "assistant",
                    "content": assistant_content
                })

                # Execute each tool and collect results
                tool_results: list[ToolResult] = []
                for tc in tool_calls:
                    all_tool_calls.append({
                        "id": tc.id,
                        "name": tc.name,
                        "arguments": tc.arguments
                    })

                    result = execute_tool(tc)
                    tool_results.append(result)

                # Add tool results to history
                messages.append({
                    "role": "user",
                    "content": _tool_results_to_content_blocks(tool_results)
                })

                # Continue loop to get Claude's response to tool results
                continue
            else:
                # No tool calls - we have the final response
                # Add assistant response to history
                messages.append({
                    "role": "assistant",
                    "content": content
                })
                break

        # Update conversation storage
        _conversations[conversation_id] = messages

        return JSONResponse({
            "content": content,
            "conversation_id": conversation_id,
            "tool_calls": all_tool_calls if all_tool_calls else None,
            "finished": True
        })

    @mcp.custom_route("/api/v1/chat/conversations/{conversation_id}", methods=["DELETE"])
    async def api_delete_conversation(request):
        """Delete a conversation from memory."""
        if err := auth.require_auth(request):
            return err

        conversation_id = request.path_params.get("conversation_id")
        if conversation_id in _conversations:
            del _conversations[conversation_id]
            return JSONResponse({"success": True})

        return api_error("Conversation not found", "NOT_FOUND", 404)
