"""
Quick Create API routes.

Endpoints for quickly creating tasks and events via natural language input.
Uses Claude (haiku) to parse the user's text and call the appropriate MCP tool.
"""

import os
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi.responses import JSONResponse

import auth
from .common import api_error
from services.chat import ChatClient, ToolCall, execute_tool

# Set up logging
_logger = logging.getLogger("routes.quick_create")


# Tool definition for add_task (minimal, just what we need)
TASK_TOOL = {
    "name": "add_task",
    "description": "Add a task to a case.",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "integer",
                "description": "The case ID to add the task to"
            },
            "description": {
                "type": "string",
                "description": "Task description"
            },
            "due_date": {
                "type": "string",
                "description": "Due date in YYYY-MM-DD format (optional)"
            },
            "urgency": {
                "type": "integer",
                "enum": [1, 2, 3, 4],
                "description": "Urgency level: 1=Low, 2=Medium, 3=High, 4=Urgent"
            }
        },
        "required": ["case_id", "description"]
    }
}

# Tool definition for add_event (minimal, just what we need)
EVENT_TOOL = {
    "name": "add_event",
    "description": "Add an event to a case.",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "integer",
                "description": "The case ID to add the event to"
            },
            "date": {
                "type": "string",
                "description": "Event date in YYYY-MM-DD format"
            },
            "description": {
                "type": "string",
                "description": "Event description"
            },
            "time": {
                "type": "string",
                "description": "Event time in HH:MM format (24-hour, optional)"
            },
            "location": {
                "type": "string",
                "description": "Event location (optional)"
            }
        },
        "required": ["case_id", "date", "description"]
    }
}


def _get_current_datetime() -> tuple[str, str]:
    """Get current date and time in Pacific timezone."""
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)
    current_date = now.strftime("%A, %B %d, %Y")
    current_time = now.strftime("%I:%M %p")
    return current_date, current_time


def _build_task_system_prompt(current_date: str, current_time: str) -> str:
    """Build system prompt for task creation."""
    return f"""Current date: {current_date}
Current time: {current_time} (Pacific Time)

Parse the user's text and create a task. Keep the description close to what they typed - only fix obvious typos. Infer the due date from natural language like "tomorrow", "next friday", "in 2 weeks". If no date mentioned, leave due_date as null.

Set urgency based on your judgment:
- 4 (Urgent): Time-sensitive, court deadlines, emergencies
- 3 (High): Important but not immediate
- 2 (Medium): Standard tasks (default)
- 1 (Low): Nice-to-have, no deadline pressure

If the user indicates priority explicitly (e.g., "urgent", "ASAP", "low priority"), follow their lead.

Call add_task with the parsed values. The case_id will be provided."""


def _build_event_system_prompt(current_date: str, current_time: str) -> str:
    """Build system prompt for event creation."""
    return f"""Current date: {current_date}
Current time: {current_time} (Pacific Time)

Parse the user's text and create an event. Keep the description close to what they typed - only fix obvious typos. Parse the date from natural language like "tomorrow", "next monday", "january 15".

If they mention a time, include it in HH:MM format (24-hour). If they mention a location (like "dept 5", "courtroom 3", "judge smith's courtroom"), include it.

Call add_event with the parsed values. The case_id will be provided."""


def register_quick_create_routes(mcp):
    """Register quick create routes."""
    _logger.info("Registering quick create routes...")

    @mcp.custom_route("/api/v1/quick/task", methods=["POST"])
    async def api_quick_create_task(request):
        """
        Create a task from natural language input.

        Request body:
            - case_id: int - The case to add the task to
            - text: str - Natural language description of the task

        Returns:
            - success: bool
            - task: Task object if successful
            - error: Error message if failed
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "INVALID_REQUEST", 400)

        case_id = data.get("case_id")
        text = data.get("text")

        if not case_id or not isinstance(case_id, int):
            return api_error("case_id is required and must be an integer", "MISSING_FIELD", 400)
        if not text or not isinstance(text, str):
            return api_error("text is required", "MISSING_FIELD", 400)

        # Initialize chat client
        try:
            client = ChatClient()
        except ValueError as e:
            return api_error(str(e), "CONFIG_ERROR", 500)

        # Build system prompt with current date/time
        current_date, current_time = _get_current_datetime()
        system_prompt = _build_task_system_prompt(current_date, current_time)

        # Create user message that includes the case_id
        user_message = f"Case ID: {case_id}\n\nCreate task: {text}"

        messages = [{"role": "user", "content": user_message}]

        try:
            # Send to Claude with only the task tool
            response = await client.send_message(
                messages=messages,
                tools=[TASK_TOOL],
                system_prompt=system_prompt
            )

            # Check for tool calls
            tool_calls = response.get("tool_calls", [])
            if not tool_calls:
                _logger.warning("Claude did not call add_task tool")
                return api_error(
                    "Could not parse task from input. Try being more specific.",
                    "PARSE_ERROR",
                    400
                )

            # Execute the tool call
            tool_call = tool_calls[0]
            _logger.info(f"Executing tool: {tool_call.name} with args: {tool_call.arguments}")

            # Ensure case_id is set (in case Claude didn't include it)
            if "case_id" not in tool_call.arguments:
                tool_call.arguments["case_id"] = case_id

            result = execute_tool(tool_call)

            if result.is_error:
                _logger.error(f"Tool execution failed: {result.content}")
                return api_error(
                    f"Failed to create task: {result.content}",
                    "EXECUTION_ERROR",
                    400
                )

            # Parse the result
            try:
                result_data = json.loads(result.content)
            except json.JSONDecodeError:
                result_data = {"raw": result.content}

            if result_data.get("success") and result_data.get("task"):
                return JSONResponse({
                    "success": True,
                    "task": result_data["task"]
                })
            else:
                error_msg = result_data.get("error", {}).get("message", "Unknown error")
                return api_error(error_msg, "CREATION_ERROR", 400)

        except Exception as e:
            _logger.exception(f"Error in quick create task: {e}")
            return api_error(str(e), "INTERNAL_ERROR", 500)

    @mcp.custom_route("/api/v1/quick/event", methods=["POST"])
    async def api_quick_create_event(request):
        """
        Create an event from natural language input.

        Request body:
            - case_id: int - The case to add the event to
            - text: str - Natural language description of the event

        Returns:
            - success: bool
            - event: Event object if successful
            - error: Error message if failed
        """
        if err := auth.require_auth(request):
            return err

        try:
            data = await request.json()
        except Exception:
            return api_error("Invalid JSON body", "INVALID_REQUEST", 400)

        case_id = data.get("case_id")
        text = data.get("text")

        if not case_id or not isinstance(case_id, int):
            return api_error("case_id is required and must be an integer", "MISSING_FIELD", 400)
        if not text or not isinstance(text, str):
            return api_error("text is required", "MISSING_FIELD", 400)

        # Initialize chat client
        try:
            client = ChatClient()
        except ValueError as e:
            return api_error(str(e), "CONFIG_ERROR", 500)

        # Build system prompt with current date/time
        current_date, current_time = _get_current_datetime()
        system_prompt = _build_event_system_prompt(current_date, current_time)

        # Create user message that includes the case_id
        user_message = f"Case ID: {case_id}\n\nCreate event: {text}"

        messages = [{"role": "user", "content": user_message}]

        try:
            # Send to Claude with only the event tool
            response = await client.send_message(
                messages=messages,
                tools=[EVENT_TOOL],
                system_prompt=system_prompt
            )

            # Check for tool calls
            tool_calls = response.get("tool_calls", [])
            if not tool_calls:
                _logger.warning("Claude did not call add_event tool")
                return api_error(
                    "Could not parse event from input. Make sure to include a date.",
                    "PARSE_ERROR",
                    400
                )

            # Execute the tool call
            tool_call = tool_calls[0]
            _logger.info(f"Executing tool: {tool_call.name} with args: {tool_call.arguments}")

            # Ensure case_id is set (in case Claude didn't include it)
            if "case_id" not in tool_call.arguments:
                tool_call.arguments["case_id"] = case_id

            result = execute_tool(tool_call)

            if result.is_error:
                _logger.error(f"Tool execution failed: {result.content}")
                return api_error(
                    f"Failed to create event: {result.content}",
                    "EXECUTION_ERROR",
                    400
                )

            # Parse the result
            try:
                result_data = json.loads(result.content)
            except json.JSONDecodeError:
                result_data = {"raw": result.content}

            if result_data.get("success") and result_data.get("event"):
                return JSONResponse({
                    "success": True,
                    "event": result_data["event"]
                })
            else:
                error_msg = result_data.get("error", {}).get("message", "Unknown error")
                return api_error(error_msg, "CREATION_ERROR", 400)

        except Exception as e:
            _logger.exception(f"Error in quick create event: {e}")
            return api_error(str(e), "INTERNAL_ERROR", 500)

    _logger.info("Quick create routes registered successfully!")
