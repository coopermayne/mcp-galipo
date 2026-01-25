#!/usr/bin/env python3
"""
Analyze chat debug logs to identify optimization opportunities.

Usage:
    python scripts/analyze_chat_logs.py [--last N] [--summary] [--tools] [--requests]

Options:
    --last N     Only analyze the last N entries
    --summary    Show high-level summary only
    --tools      Show tool usage breakdown
    --requests   Show request token breakdown
    --clear      Clear the log file
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

LOG_FILE = Path(__file__).parent.parent / "logs" / "chat" / "debug.jsonl"


def load_entries(limit: int | None = None) -> list[dict]:
    """Load log entries, optionally limiting to last N."""
    if not LOG_FILE.exists():
        print(f"No log file found at {LOG_FILE}")
        print("Enable debug logging with: CHAT_DEBUG=true")
        sys.exit(1)

    entries = []
    with open(LOG_FILE) as f:
        for line in f:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    if limit:
        entries = entries[-limit:]

    return entries


def show_summary(entries: list[dict]):
    """Show high-level summary."""
    requests = [e for e in entries if e["type"] == "request"]
    responses = [e for e in entries if e["type"] == "response"]
    tool_execs = [e for e in entries if e["type"] == "tool_execution"]

    print("\n=== CHAT DEBUG SUMMARY ===\n")
    print(f"Total log entries: {len(entries)}")
    print(f"  Requests: {len(requests)}")
    print(f"  Responses: {len(responses)}")
    print(f"  Tool executions: {len(tool_execs)}")

    if requests:
        # Token analysis
        total_tokens = sum(r["token_estimates"]["total"] for r in requests)
        avg_tokens = total_tokens // len(requests)

        print(f"\n--- Request Token Estimates ---")
        print(f"  Total tokens across all requests: {total_tokens:,}")
        print(f"  Average per request: {avg_tokens:,}")

        # Breakdown
        system_tokens = sum(r["token_estimates"]["system_prompt"] for r in requests)
        message_tokens = sum(r["token_estimates"]["messages"] for r in requests)
        tools_tokens = sum(r["token_estimates"]["tools"] for r in requests)

        print(f"\n  Breakdown (averages):")
        print(f"    System prompt: {system_tokens // len(requests):,} tokens")
        print(f"    Messages: {message_tokens // len(requests):,} tokens")
        print(f"    Tool definitions: {tools_tokens // len(requests):,} tokens")

        # Tool count
        if requests[0].get("tool_count"):
            print(f"\n  Tools sent per request: {requests[0]['tool_count']}")


def show_tools(entries: list[dict]):
    """Show tool usage breakdown."""
    tool_execs = [e for e in entries if e["type"] == "tool_execution"]

    if not tool_execs:
        print("\nNo tool executions found in logs.")
        return

    # Count by tool
    tool_counts = defaultdict(int)
    tool_tokens = defaultdict(list)
    tool_durations = defaultdict(list)

    for e in tool_execs:
        name = e["tool_name"]
        tool_counts[name] += 1
        tool_tokens[name].append(e["result_tokens"])
        tool_durations[name].append(e["duration_ms"])

    print("\n=== TOOL USAGE ===\n")
    print(f"{'Tool Name':<40} {'Calls':>6} {'Avg Tokens':>12} {'Avg Time':>10}")
    print("-" * 70)

    for name in sorted(tool_counts.keys(), key=lambda x: -tool_counts[x]):
        count = tool_counts[name]
        avg_tokens = sum(tool_tokens[name]) // len(tool_tokens[name])
        avg_duration = sum(tool_durations[name]) // len(tool_durations[name])
        print(f"{name:<40} {count:>6} {avg_tokens:>12} {avg_duration:>8}ms")

    print("-" * 70)
    print(f"{'TOTAL':<40} {sum(tool_counts.values()):>6}")


def show_requests(entries: list[dict]):
    """Show detailed request breakdown."""
    requests = [e for e in entries if e["type"] == "request"]

    if not requests:
        print("\nNo requests found in logs.")
        return

    print("\n=== REQUEST DETAILS ===\n")

    for i, req in enumerate(requests[-5:], 1):  # Last 5 requests
        print(f"--- Request {i} ({req['timestamp']}) ---")
        print(f"  Conversation: {req['conversation_id'][:8]}...")
        print(f"  Case context: {req.get('case_context', 'None')}")
        print(f"  Message count: {req['message_count']}")
        print(f"  Tool count: {req['tool_count']}")
        print(f"  Token estimates:")
        for k, v in req["token_estimates"].items():
            print(f"    {k}: {v:,}")
        print()


def show_tool_definitions(entries: list[dict]):
    """Show which tools are being sent."""
    requests = [e for e in entries if e["type"] == "request" and e.get("tools")]

    if not requests:
        print("\nNo requests with tools found.")
        return

    # Get latest tool list
    tools = requests[-1].get("tools", [])

    print("\n=== TOOL DEFINITIONS SENT ===\n")
    print(f"Total tools: {len(tools)}")
    print()

    # Group by prefix
    groups = defaultdict(list)
    for tool in tools:
        name = tool["name"]
        prefix = name.split("_")[0] if "_" in name else name
        groups[prefix].append(name)

    for prefix in sorted(groups.keys()):
        names = groups[prefix]
        print(f"{prefix}_ ({len(names)} tools)")
        for name in sorted(names):
            desc = next((t["description"][:60] for t in tools if t["name"] == name), "")
            print(f"  - {name}: {desc}...")
        print()


def main():
    args = sys.argv[1:]

    if "--clear" in args:
        if LOG_FILE.exists():
            LOG_FILE.unlink()
            print(f"Cleared {LOG_FILE}")
        else:
            print("No log file to clear.")
        return

    limit = None
    if "--last" in args:
        idx = args.index("--last")
        if idx + 1 < len(args):
            limit = int(args[idx + 1])

    entries = load_entries(limit)

    if not entries:
        print("No entries in log file.")
        return

    if "--summary" in args or not any(x in args for x in ["--tools", "--requests", "--definitions"]):
        show_summary(entries)

    if "--tools" in args:
        show_tools(entries)

    if "--requests" in args:
        show_requests(entries)

    if "--definitions" in args:
        show_tool_definitions(entries)

    if not args or args == ["--summary"]:
        print("\nRun with --tools, --requests, or --definitions for more details.")


if __name__ == "__main__":
    main()
