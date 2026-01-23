"""
Chat API routes.

Handles chat interactions with Claude AI, including tool execution loop.
Supports both synchronous requests and Server-Sent Events (SSE) streaming.
"""

import uuid
import json
import time
import logging
import asyncio
import threading
from typing import Any, AsyncGenerator
from pathlib import Path
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

import auth
from .common import api_error


# Rate limiting configuration
RATE_LIMIT_REQUESTS = 20  # Maximum requests per window
RATE_LIMIT_WINDOW = 60  # Window size in seconds (1 minute)


class RateLimiter:
    """
    In-memory rate limiter that tracks requests per user.

    Uses a sliding window approach: stores timestamps of requests and
    counts how many fall within the current window.
    """

    def __init__(self, max_requests: int = RATE_LIMIT_REQUESTS, window_seconds: int = RATE_LIMIT_WINDOW):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Key: username, Value: list of request timestamps
        self._requests: dict[str, list[float]] = {}
        self._lock = threading.Lock()
        self._last_cleanup = time.time()
        self._cleanup_interval = 300  # Clean up every 5 minutes

    def _cleanup_old_entries(self) -> None:
        """Remove entries for users with no recent requests."""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return

        self._last_cleanup = now
        cutoff = now - self.window_seconds

        # Remove users with no requests in the window
        users_to_remove = []
        for username, timestamps in self._requests.items():
            # Filter to only recent timestamps
            recent = [t for t in timestamps if t > cutoff]
            if not recent:
                users_to_remove.append(username)
            else:
                self._requests[username] = recent

        for username in users_to_remove:
            del self._requests[username]

    def check_rate_limit(self, username: str) -> tuple[bool, int]:
        """
        Check if a user is within their rate limit.

        Returns:
            tuple of (allowed: bool, retry_after: int)
            - allowed: True if request should proceed, False if rate limited
            - retry_after: seconds until the oldest request expires (only meaningful if not allowed)
        """
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            # Periodically clean up old entries
            self._cleanup_old_entries()

            # Get or create request list for user
            if username not in self._requests:
                self._requests[username] = []

            # Filter to only requests within the window
            timestamps = self._requests[username]
            recent = [t for t in timestamps if t > cutoff]
            self._requests[username] = recent

            if len(recent) >= self.max_requests:
                # Rate limited - calculate retry_after
                oldest = min(recent)
                retry_after = int(oldest + self.window_seconds - now) + 1
                return False, max(1, retry_after)

            # Within limit - record this request
            self._requests[username].append(now)
            return True, 0


# Global rate limiter instance for the chat stream endpoint
_chat_rate_limiter = RateLimiter()

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
    StreamEventType,
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


def _get_username_from_request(request) -> str | None:
    """
    Extract the username from the request's auth token.

    Returns the username if the token is valid, None otherwise.
    """
    token = auth.get_token_from_request(request)
    if not token:
        return None

    # Access the session storage to get the username
    if token in auth._sessions:
        username, expiry = auth._sessions[token]
        if time.time() <= expiry:
            return username
    return None


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

    @mcp.custom_route("/api/v1/chat/stream", methods=["POST"])
    async def api_chat_stream(request):
        """
        Stream a chat response using Server-Sent Events (SSE).

        Request body:
            - message: str - The user's message
            - conversation_id: str | None - Optional conversation ID for continuing a conversation
            - case_context: int | None - Optional case ID if user is viewing a case

        SSE Events (JSON per line):
            - {"type": "text", "content": "partial text..."}
            - {"type": "tool_start", "id": "...", "name": "get_case"}
            - {"type": "tool_result", "id": "...", "result": "...", "duration_ms": 123}
            - {"type": "done", "conversation_id": "..."}
            - {"type": "error", "message": "..."}
        """
        if err := auth.require_auth(request):
            return err

        # Rate limiting check
        username = _get_username_from_request(request)
        if username:
            allowed, retry_after = _chat_rate_limiter.check_rate_limit(username)
            if not allowed:
                return JSONResponse(
                    {
                        "success": False,
                        "error": {
                            "message": f"Rate limit exceeded. You can make up to {RATE_LIMIT_REQUESTS} requests per minute. Please try again in {retry_after} seconds.",
                            "code": "RATE_LIMIT_EXCEEDED"
                        }
                    },
                    status_code=429,
                    headers={"Retry-After": str(retry_after)}
                )

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
            # Remove the user message we added
            messages.pop()
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

        async def generate_sse_events() -> AsyncGenerator[str, None]:
            """Generate SSE events from Claude's streaming response."""
            nonlocal messages

            # Track all tool calls for conversation history
            all_tool_calls: list[dict[str, Any]] = []
            accumulated_text = ""

            # Conversation loop - continue until no more tool calls
            max_iterations = 10
            iteration = 0

            try:
                while iteration < max_iterations:
                    iteration += 1

                    # Track tool calls from this iteration
                    iteration_tool_calls: list[ToolCall] = []
                    iteration_text = ""

                    try:
                        # Stream the response from Claude
                        for event in client.stream_message(
                            messages=messages,
                            tools=tools if tools else None,
                            system_prompt=system_prompt
                        ):
                            event_type = event.get("type")

                            if event_type == StreamEventType.TEXT.value:
                                # Send text delta to client
                                content = event.get("content", "")
                                iteration_text += content
                                yield f"data: {json.dumps({'type': 'text', 'content': content})}\n\n"

                            elif event_type == StreamEventType.TOOL_USE.value:
                                subtype = event.get("subtype")

                                if subtype == "start":
                                    # Tool use starting - send tool_start event
                                    yield f"data: {json.dumps({'type': 'tool_start', 'id': event.get('id'), 'name': event.get('name')})}\n\n"

                                elif subtype == "done":
                                    # Tool use complete - we have the full arguments
                                    tool_id = event.get("id")
                                    tool_name = event.get("name")
                                    tool_args = event.get("arguments", {})

                                    # Create ToolCall object
                                    tool_call = ToolCall(
                                        id=tool_id,
                                        name=tool_name,
                                        arguments=tool_args
                                    )
                                    iteration_tool_calls.append(tool_call)

                                    # Track for response
                                    all_tool_calls.append({
                                        "id": tool_id,
                                        "name": tool_name,
                                        "arguments": tool_args
                                    })

                            elif event_type == "message_stop":
                                # Message complete - check stop reason
                                stop_reason = event.get("stop_reason")

                                if stop_reason == "tool_use" and iteration_tool_calls:
                                    # Add assistant message with tool calls to history
                                    assistant_content: list[dict[str, Any]] = []
                                    if iteration_text:
                                        assistant_content.append({"type": "text", "text": iteration_text})
                                    assistant_content.extend(_tool_calls_to_content_blocks(iteration_tool_calls))

                                    messages.append({
                                        "role": "assistant",
                                        "content": assistant_content
                                    })

                                    # Execute each tool and send results
                                    tool_results: list[ToolResult] = []
                                    for tc in iteration_tool_calls:
                                        start_time = time.time()
                                        result = execute_tool(tc)
                                        duration_ms = int((time.time() - start_time) * 1000)

                                        tool_results.append(result)

                                        # Send tool_result event
                                        yield f"data: {json.dumps({'type': 'tool_result', 'id': tc.id, 'name': tc.name, 'result': result.content, 'is_error': result.is_error, 'duration_ms': duration_ms})}\n\n"

                                    # Add tool results to history
                                    messages.append({
                                        "role": "user",
                                        "content": _tool_results_to_content_blocks(tool_results)
                                    })

                                    # Continue loop to get Claude's response to tool results
                                    break
                                else:
                                    # No more tool calls - we're done
                                    accumulated_text += iteration_text

                                    # Add assistant response to history
                                    if iteration_text:
                                        messages.append({
                                            "role": "assistant",
                                            "content": iteration_text
                                        })

                                    # Update conversation storage
                                    _conversations[conversation_id] = messages

                                    # Send done event
                                    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'tool_calls': all_tool_calls if all_tool_calls else None})}\n\n"
                                    return

                    except Exception as e:
                        _logger.exception(f"Error in stream iteration: {e}")
                        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                        return

                # If we hit max iterations, send done event
                _conversations[conversation_id] = messages
                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'tool_calls': all_tool_calls if all_tool_calls else None})}\n\n"

            except Exception as e:
                _logger.exception(f"Error in SSE generation: {e}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        return StreamingResponse(
            generate_sse_events(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            }
        )

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
