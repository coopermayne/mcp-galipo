"""
Claude models used by the app, one per job.

These live in code, not env: a model and the request code that talks to it
change together (newer models reject some request shapes, e.g. forced
tool_choice), so switching models is a reviewed code change that ships with
any request changes it needs — never a server setting.

Every Claude call imports its model from here.
"""

# Chat in scoped modes (tasks, events, people…) and preset summaries —
# clear intent, few tools, latency matters.
CHAT_FAST = "claude-haiku-4-5"

# Freeform chat, case setup and intake chat, plus the one-shot structured
# calls that need judgment: quick-create, work-log consolidation, intake AI.
CHAT = "claude-sonnet-4-6"

# Field extraction from documents/text (invoices, intakes, cases, RFPs) and
# short interaction summaries — high volume, simple structure.
EXTRACTION = "claude-haiku-4-5"

# Table of Authorities extraction — long briefs, citation resolution.
TOA_EXTRACTION = "claude-sonnet-4-6"
