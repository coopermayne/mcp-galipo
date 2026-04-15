"""
Programmatic Tool Calling (PTC) service.

Uses Anthropic's code execution sandbox to let Claude write Python scripts
that call tools as async functions. Tool results stay in the sandbox;
only the final print() output returns to context.
"""

from .agent import run_ptc_query, run_ptc_query_stream

__all__ = ["run_ptc_query", "run_ptc_query_stream"]
