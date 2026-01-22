"""
Shared utility functions for MCP tools.
"""


def error_response(message: str, code: str) -> dict:
    """Create a standardized error response for MCP tools."""
    return {"success": False, "error": {"message": message, "code": code}}


def validation_error(message: str) -> dict:
    """Create a validation error response."""
    return error_response(message, "VALIDATION_ERROR")


def not_found_error(resource: str) -> dict:
    """Create a not found error response."""
    return error_response(f"{resource} not found", "NOT_FOUND")
