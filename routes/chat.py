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
    get_mode_system_prompt,
    get_preset_context,
    execute_tool,
    log_request,
    log_response,
    log_tool_execution,
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
    Extract the username from the request's JWT token.

    Returns the username if the token is valid, None otherwise.
    """
    import jwt

    token = auth.get_token_from_request(request)
    if not token:
        return None

    try:
        payload = jwt.decode(token, auth.JWT_SECRET, algorithms=[auth.JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.InvalidTokenError:
        return None


def register_chat_routes(mcp):
    """Register chat routes."""
    _logger.info("register_chat_routes called")

    # Debug endpoint - no auth required, just for testing
    @mcp.custom_route("/api/v1/chat/debug", methods=["GET"])
    async def api_chat_debug(request):
        _logger.info("Debug endpoint hit!")
        return JSONResponse({"status": "ok", "message": "Chat routes are registered!"})

    @mcp.custom_route("/api/v1/chat/info", methods=["GET"])
    async def api_chat_info(request):
        """Return chat configuration info (model name, etc.)."""
        from config import settings as _settings
        return JSONResponse({
            "model": _settings.chat_model,
            "model_full": _settings.chat_model_full,
            "model_max": _settings.chat_model_max,
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
        intake_context = data.get("intake_context")
        mode = data.get("mode")  # Optional: tasks, events, people, overview, full
        preset = data.get("preset")  # Optional: priorities, deadlines, overdue, activity
        _logger.info(f"Chat request - mode: {mode}, preset: {preset}, case_context: {case_context}, intake_context: {intake_context}")

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

        # Look up logged-in user and available roles for system prompt context
        import db as _db
        current_user = None
        if username:
            current_user = _db.get_user_by_email(username)
        available_roles = _db.get_roles()
        _current_user_id = current_user["id"] if current_user else None

        # Handle presets (no tools needed - data is pre-fetched)
        preset_data = None
        preset_prompt = None
        if preset:
            result = get_preset_context(preset, case_context, user_id=_current_user_id)
            if result:
                preset_data, preset_prompt = result
                _logger.info(f"Preset '{preset}' loaded with data")

        # Get tool definitions (filtered by mode if specified, empty for presets)
        if preset_data:
            tools = []  # No tools needed for presets
        else:
            tools = get_tool_definitions(mode)
        # Log detailed tool breakdown
        eager_tools = [t["name"] for t in tools if not t.get("defer_loading") and "type" not in t]
        deferred_tools = [t["name"] for t in tools if t.get("defer_loading")]
        server_tools = [t.get("name", t.get("type", "?")) for t in tools if "type" in t]
        _logger.info(f"Tools: {len(tools)} total | eager={eager_tools} | deferred={deferred_tools} | server={server_tools}")

        # Model selection: Opus for case_setup, Sonnet for freeform/intakes, Haiku for scoped modes
        if preset_data:
            selected_model = None  # Default (haiku) — just summarizing pre-loaded data
        elif mode == "case_setup":
            selected_model = client.model_full  # Sonnet — structured multi-tool case creation
        elif mode == "intakes":
            selected_model = client.model_full  # Sonnet — intake parsing needs smarter model
        elif mode and mode != "full":
            selected_model = None  # Default (haiku) — scoped tools, clear intent
        else:
            selected_model = client.model_full  # Sonnet — freeform, all tools
        _logger.info(f"Selected model: {selected_model or client.model}")

        # Build system prompt with current date and optional case context
        from datetime import datetime, timedelta
        from zoneinfo import ZoneInfo
        pacific = ZoneInfo("America/Los_Angeles")
        now_pacific = datetime.now(pacific)
        current_date = now_pacific.strftime("%A, %B %d, %Y")
        iso_date = now_pacific.strftime("%Y-%m-%d")
        current_time = now_pacific.strftime("%I:%M %p")

        # Pre-compute the next 14 days so the model never has to do date arithmetic.
        today_date = now_pacific.date()
        upcoming_lines = []
        for i in range(15):
            d = today_date + timedelta(days=i)
            iso = d.isoformat()
            weekday = d.strftime("%A")
            if i == 0:
                label = f"  Today ({weekday}): {iso}"
            elif i == 1:
                label = f"  Tomorrow ({weekday}): {iso}"
            elif i < 7:
                label = f"  {weekday}: {iso}"
            elif i == 7:
                label = f"  Next {weekday} (one week out, same weekday as today): {iso}"
            else:
                label = f"  Next {weekday}: {iso}"
            upcoming_lines.append(label)
        upcoming_table = "\n".join(upcoming_lines)

        system_prompt = f"""You are an AI assistant for Galipo, a legal case management system for personal injury law firms.

Current date: {current_date} ({iso_date})
Current time: {current_time} (Pacific Time)

Upcoming dates (use these — do not do date arithmetic yourself):
{upcoming_table}

You can help users:
- Query case information, tasks, deadlines, events, contacts
- Create and update notes, tasks, and events
- Search for persons and contacts

Resolving relative day names to ISO dates:
- "Wednesday" or "this Wednesday" → look up the row labeled Wednesday above (the nearest upcoming Wednesday).
- "next Wednesday" → if today is Wed, use the row labeled "Next Wednesday" (one week out). Otherwise it's the same as "this Wednesday" — when ambiguous, prefer the nearest upcoming occurrence.
- "tomorrow" → the row labeled Tomorrow.
- Always copy the ISO date directly from the table above. Never compute it yourself.

When dates are mentioned without a year, infer the year from context.

Always be helpful and concise. When you need more information to complete a task, ask clarifying questions."""

        # Add logged-in user identity
        if current_user:
            user_name = f"{current_user['first_name']} {current_user['last_name']}"
            user_info = f"\n\nYou are speaking with {user_name} (user ID: {current_user['id']}, position: {current_user['position']})."
            if current_user.get('paralegal_id') and current_user.get('paralegal'):
                p = current_user['paralegal']
                user_info += f" Their default paralegal is {p['first_name']} {p['last_name']} (user ID: {p['id']})."
            system_prompt += user_info
            system_prompt += "\n\nSearch queries default to your cases only (my_cases_only=true). If the user asks for firm-wide data or another attorney's cases, set my_cases_only=false."

        # Add staff directory so AI can resolve attorney/paralegal IDs
        all_users = _db.get_all_users()
        if all_users:
            staff_lines = [f"  {u['id']}: {u['first_name']} {u['last_name']} ({u['position']})" for u in all_users]
            system_prompt += "\n\nStaff directory (id: name, position):\n" + "\n".join(staff_lines)

        # Add available roles for person assignment
        if available_roles:
            roles_by_category: dict[str, list[str]] = {}
            for r in available_roles:
                cat = r.get("category", "other")
                roles_by_category.setdefault(cat, []).append(r["name"])
            roles_text = "\n\nAvailable roles for person assignment (use these exact names with manage_person or manage_case_role):"
            for cat, names in roles_by_category.items():
                roles_text += f"\n  {cat}: {', '.join(names)}"
            roles_text += "\nIf you need a role not listed above, you can use any name — it will be created automatically."
            system_prompt += roles_text

        if case_context:
            system_prompt += f"""

The user is currently viewing case ID: {case_context}. When they ask about "this case" or "the case", they mean case ID {case_context}."""

            try:
                proceedings = _db.get_proceedings(case_context)
            except Exception as e:
                _logger.warning(f"Failed to pre-load proceedings for case {case_context}: {e}")
                proceedings = []

            if proceedings:
                lines = []
                for p in proceedings:
                    judges = p.get("judges") or []
                    judges_str = ", ".join(
                        f"{j.get('name')} (judge_id={j.get('judge_id')})" for j in judges
                    ) or "none"
                    lines.append(
                        f"  - proceeding_id={p['id']}, case_number={p.get('case_number') or 'N/A'}, "
                        f"jurisdiction={p.get('jurisdiction_name') or 'N/A'}, "
                        f"primary={bool(p.get('is_primary'))}, judges=[{judges_str}]"
                    )
                default_note = (
                    "This is the only proceeding — use its proceeding_id directly when the user refers to \"the proceeding\"."
                    if len(proceedings) == 1
                    else "When the user refers to \"the proceeding\" without specifying, default to the primary proceeding. If the user's reference is ambiguous across multiple proceedings, ask a brief clarifying question."
                )
                system_prompt += (
                    "\n\nProceedings already attached to this case (use these proceeding_ids directly — do NOT call get_details just to look them up):\n"
                    + "\n".join(lines)
                    + f"\n{default_note}"
                )
            else:
                system_prompt += (
                    "\n\nThis case currently has NO proceedings. Before adding a judge, you must first create a proceeding with manage_proceeding(action=\"create\", case_id="
                    + str(case_context)
                    + ", case_number=...)."
                )

        if intake_context:
            try:
                intake_data = _db.get_intake(intake_context)
            except Exception as e:
                _logger.warning(f"Failed to load intake context {intake_context}: {e}")
                intake_data = None

            if intake_data:
                system_prompt += f"""

The user is currently viewing intake ID: {intake_context}. When they ask about "this intake" or "the intake", they mean intake ID {intake_context}.
Intake details:
  - Name: {intake_data.get('name', 'N/A')}
  - Case type: {intake_data.get('case_type', 'N/A')}
  - Status: {intake_data.get('status', 'N/A')}
  - Incident date: {intake_data.get('incident_date', 'N/A')}
  - Location: {intake_data.get('location_short') or intake_data.get('location', 'N/A')}
  - Incident: {(intake_data.get('incident_description') or 'N/A')[:500]}
  - Injuries: {(intake_data.get('injury_description') or 'N/A')[:300]}

When creating tasks for this intake, use manage_task with intake_id={intake_context} (NOT case_id). These are pre-case intake follow-up tasks."""

        # Add mode-specific system prompt if a mode is active
        mode_prompt = get_mode_system_prompt(mode)
        if mode_prompt:
            system_prompt += f"""

{mode_prompt}"""

        # Add preset data and prompt if a preset is active
        if preset_data and preset_prompt:
            system_prompt += f"""

{preset_prompt}

DATA:
```json
{json.dumps(preset_data, indent=2)}
```"""

        async def generate_sse_events() -> AsyncGenerator[str, None]:
            """Generate SSE events from Claude's streaming response."""
            nonlocal messages

            # Track all tool calls for conversation history
            all_tool_calls: list[dict[str, Any]] = []
            accumulated_text = ""

            # Track cumulative token usage across iterations
            total_input_tokens = 0
            total_output_tokens = 0
            total_cache_creation_tokens = 0
            total_cache_read_tokens = 0

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
                        # Log the request before sending
                        log_request(
                            conversation_id=conversation_id,
                            system_prompt=system_prompt,
                            messages=messages,
                            tools=tools,
                            case_context=case_context,
                        )

                        # Stream the response from Claude
                        async for event in client.stream_message(
                            messages=messages,
                            tools=tools if tools else None,
                            system_prompt=system_prompt,
                            model=selected_model,
                        ):
                            event_type = event.get("type")

                            if event_type == StreamEventType.TEXT.value:
                                # Send text delta to client
                                content = event.get("content", "")
                                iteration_text += content
                                yield f"data: {json.dumps({'type': 'text', 'content': content})}\n\n"
                                await asyncio.sleep(0)  # Flush to client

                            elif event_type == "server_tool_use":
                                # Server-side tool (tool search) — Anthropic handles execution
                                subtype = event.get("subtype")
                                if subtype == "start":
                                    _logger.info(f"[deferred] Tool search triggered by Claude (server_tool_use start)")
                                    yield f"data: {json.dumps({'type': 'tool_search', 'status': 'searching'})}\n\n"
                                    await asyncio.sleep(0)
                                elif subtype == "done":
                                    _logger.info(f"[deferred] Tool search complete (server_tool_use done)")

                            elif event_type == "tool_search_result":
                                # Tool search found tools — inform the client
                                tools_found = event.get("tools_found", [])
                                _logger.info(f"[deferred] Tool search results: {tools_found}")
                                if tools_found:
                                    yield f"data: {json.dumps({'type': 'tool_search', 'status': 'found', 'tools': tools_found})}\n\n"
                                    await asyncio.sleep(0)

                            elif event_type == StreamEventType.TOOL_USE.value:
                                subtype = event.get("subtype")

                                if subtype == "start":
                                    # Tool use starting - send tool_start event
                                    yield f"data: {json.dumps({'type': 'tool_start', 'id': event.get('id'), 'name': event.get('name')})}\n\n"
                                    await asyncio.sleep(0)  # Flush to client

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

                                # Accumulate usage data from this iteration
                                usage = event.get("usage")
                                if usage:
                                    total_input_tokens += usage.get("input_tokens", 0)
                                    total_output_tokens += usage.get("output_tokens", 0)
                                    total_cache_creation_tokens += usage.get("cache_creation_input_tokens", 0)
                                    total_cache_read_tokens += usage.get("cache_read_input_tokens", 0)
                                    _logger.info(
                                        f"[tokens] iter={iteration} in={usage.get('input_tokens',0)} out={usage.get('output_tokens',0)} "
                                        f"cache_create={usage.get('cache_creation_input_tokens',0)} cache_read={usage.get('cache_read_input_tokens',0)} "
                                        f"stop={stop_reason} tools_called={[tc.name for tc in iteration_tool_calls]}"
                                    )

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
                                    _current_user_id = current_user["id"] if current_user else None
                                    for tc in iteration_tool_calls:
                                        start_time = time.time()
                                        result = execute_tool(tc, user_id=_current_user_id)
                                        duration_ms = int((time.time() - start_time) * 1000)

                                        tool_results.append(result)

                                        # Log tool execution
                                        log_tool_execution(
                                            conversation_id=conversation_id,
                                            tool_name=tc.name,
                                            tool_id=tc.id,
                                            arguments=tc.arguments,
                                            result=result.content,
                                            is_error=result.is_error,
                                            duration_ms=duration_ms,
                                        )

                                        # Send tool_result event
                                        yield f"data: {json.dumps({'type': 'tool_result', 'id': tc.id, 'name': tc.name, 'result': result.content, 'is_error': result.is_error, 'duration_ms': duration_ms})}\n\n"
                                        await asyncio.sleep(0)  # Flush to client

                                    # Detect successful manage_intake creation → log chat transcript
                                    for tc, tr in zip(iteration_tool_calls, tool_results):
                                        if tc.name == "manage_intake" and not tr.is_error:
                                            try:
                                                result_data = json.loads(tr.content) if isinstance(tr.content, str) else tr.content
                                                new_intake_id = result_data.get("intake_id") if isinstance(result_data, dict) else None
                                                if new_intake_id:
                                                    # Sanitize conversation: keep only role + text content
                                                    sanitized = []
                                                    for msg in messages:
                                                        role = msg.get("role", "")
                                                        content = msg.get("content", "")
                                                        if isinstance(content, str):
                                                            sanitized.append({"role": role, "content": content})
                                                        elif isinstance(content, list):
                                                            text_parts = [b.get("text", "") for b in content if b.get("type") == "text"]
                                                            if text_parts:
                                                                sanitized.append({"role": role, "content": " ".join(text_parts)})
                                                    import db as _db_chat
                                                    _db_chat.add_intake_comment(
                                                        new_intake_id,
                                                        _current_user_id,
                                                        "Intake created via AI chat",
                                                        True,  # is_system
                                                        detail={"type": "chat_transcript", "messages": sanitized},
                                                    )
                                            except Exception:
                                                _logger.exception("Failed to log AI chat intake creation")

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

                                    # Log the final response
                                    log_response(
                                        conversation_id=conversation_id,
                                        content=accumulated_text,
                                        tool_calls=all_tool_calls if all_tool_calls else None,
                                        stop_reason=stop_reason,
                                    )

                                    # Add assistant response to history
                                    if iteration_text:
                                        messages.append({
                                            "role": "assistant",
                                            "content": iteration_text
                                        })

                                    # Update conversation storage
                                    _conversations[conversation_id] = messages

                                    # Send usage event before done
                                    if total_input_tokens > 0 or total_output_tokens > 0:
                                        usage_data = {
                                            'type': 'usage',
                                            'input_tokens': total_input_tokens,
                                            'output_tokens': total_output_tokens,
                                            'cache_read_input_tokens': total_cache_read_tokens,
                                            'cache_creation_input_tokens': total_cache_creation_tokens,
                                            'request': {
                                                'system_prompt': system_prompt[:2000] if system_prompt else '',
                                                'messages': messages,
                                                'tools': [t['name'] for t in tools] if tools else [],
                                                'tool_count': len(tools) if tools else 0,
                                            },
                                            'response': {
                                                'content': accumulated_text,
                                                'stop_reason': stop_reason,
                                                'tool_calls': all_tool_calls,
                                            }
                                        }
                                        yield f"data: {json.dumps(usage_data)}\n\n"
                                        await asyncio.sleep(0)  # Flush to client

                                    # Send done event
                                    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'tool_calls': all_tool_calls if all_tool_calls else None, 'model': selected_model or client.model})}\n\n"
                                    await asyncio.sleep(0)  # Flush to client
                                    return

                    except Exception as e:
                        _logger.exception(f"Error in stream iteration: {e}")
                        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                        await asyncio.sleep(0)  # Flush to client
                        return

                # If we hit max iterations, send usage and done events
                _conversations[conversation_id] = messages

                # Send usage event
                if total_input_tokens > 0 or total_output_tokens > 0:
                    usage_data = {
                        'type': 'usage',
                        'input_tokens': total_input_tokens,
                        'output_tokens': total_output_tokens,
                        'cache_read_input_tokens': total_cache_read_tokens,
                        'cache_creation_input_tokens': total_cache_creation_tokens,
                        'request': {
                            'system_prompt': system_prompt[:2000] if system_prompt else '',
                            'messages': messages,
                            'tools': [t['name'] for t in tools] if tools else [],
                            'tool_count': len(tools) if tools else 0,
                        },
                        'response': {
                            'content': accumulated_text,
                            'stop_reason': 'max_iterations',
                            'tool_calls': all_tool_calls,
                        }
                    }
                    yield f"data: {json.dumps(usage_data)}\n\n"
                    await asyncio.sleep(0)  # Flush to client

                yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'tool_calls': all_tool_calls if all_tool_calls else None, 'model': selected_model or client.model})}\n\n"
                await asyncio.sleep(0)  # Flush to client

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
