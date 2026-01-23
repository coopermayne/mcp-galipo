# In-App AI Chat Feature Implementation Plan

## Overview

Add a natural language chat interface that allows users to interact with the case management system through conversation. The AI assistant (Claude) has access to all existing MCP tools and can:
- Answer questions about cases, tasks, deadlines, contacts
- Create/update data (add notes, schedule events, create tasks)
- Ask clarifying questions when information is missing

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation | ✅ Complete | Basic chat with tool execution working |
| Phase 2: Streaming | ✅ Complete | SSE streaming, tool indicators with timing |
| Phase 3: Context & Intelligence | 🟡 Partial | Basic context done, persistence not started |
| Phase 4: Polish | 🟡 Partial | Integration done, polish items remaining |

### Recent Fixes
- **Tool schema unification** (2026-01-23): Chat tools now dynamically generated from MCP tools, ensuring consistency. Removed hardcoded TOOL_DEFINITIONS dict.
- **Internal context cleanup** (2026-01-23): Fixed tool schemas to remove internal `context` parameter that was leaking through to Claude.
- **Conversation context loss** (2026-01-23): Fixed camelCase/snake_case mismatch in API requests. Frontend now converts `conversationId` → `conversation_id` before sending to backend.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ ChatButton   │→ │ ChatPanel    │→ │ MessageList / InputBar   │  │
│  │ (FAB)        │  │ (Drawer)     │  │ (Components)             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                            │                                         │
│                            ▼ POST /api/v1/chat (SSE stream)         │
└─────────────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────────────┐
│                           Backend                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ routes/      │→ │ services/    │→ │ services/chat/           │  │
│  │ chat.py      │  │ chat/        │  │ executor.py              │  │
│  │              │  │ client.py    │  │ (runs MCP tools)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                            │                    │                    │
│                            ▼                    ▼                    │
│                    Claude API            Existing db/* functions    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE

**Goal**: Basic working chat with tool execution (no streaming)

#### Dev 1: Backend Chat API & Claude Client ✅

**Files created:**
- [x] `services/chat/__init__.py`
- [x] `services/chat/types.py`
- [x] `services/chat/client.py`
- [x] `routes/chat.py`

**Tasks:**
- [x] Create `services/chat/types.py` with dataclasses for messages, requests, responses
- [x] Create `services/chat/client.py` with ChatClient class wrapping Anthropic SDK
- [x] Create `routes/chat.py` with POST /api/v1/chat endpoint
- [x] Add conversation history storage (in-memory dict)

#### Dev 2: Backend Tool Registry & Executor ✅

**Files created:**
- [x] `services/chat/tools.py`
- [x] `services/chat/executor.py`

**Tasks:**
- [x] Create `get_tool_definitions()` returning Claude tool schemas
- [x] Create `execute_tool(name, arguments)` for tool execution
- [x] Handle errors gracefully

#### Dev 3: Frontend Chat UI ✅

**Files created:**
- [x] `frontend/src/types/chat.ts`
- [x] `frontend/src/api/chat.ts`
- [x] `frontend/src/components/chat/ChatButton.tsx`
- [x] `frontend/src/components/chat/ChatPanel.tsx`
- [x] `frontend/src/components/chat/MessageList.tsx`
- [x] `frontend/src/components/chat/ChatInput.tsx`
- [x] `frontend/src/components/chat/index.ts`

**Tasks:**
- [x] Floating action button (bottom-right corner)
- [x] Slide-out drawer panel
- [x] Message list with user/assistant styling
- [x] Input with Enter to send, Shift+Enter for newline
- [x] Auto-scroll to bottom on new messages

---

### Phase 2: Streaming & Tool Visualization ✅ COMPLETE

**Goal**: Real-time streaming responses, visual feedback for tool execution

#### Dev 1: Streaming Response ✅

**Files modified:**
- [x] `services/chat/client.py` - Added `stream_message()` method
- [x] `routes/chat.py` - Added `POST /api/v1/chat/stream` SSE endpoint

**Tasks:**
- [x] Update `ChatClient` to use streaming API
- [x] Create `/api/v1/chat/stream` SSE endpoint (kept original endpoint for compatibility)
- [x] Handle tool execution mid-stream with result events

#### Dev 2: Tool Result Formatting ✅

**Files modified:**
- [x] `services/chat/executor.py`
- [x] `services/chat/types.py`

**Tasks:**
- [x] Add result summarization for large responses (>4000 chars)
- [x] Add timing information to tool results (`duration_ms`)
- [x] Create human-readable tool execution summaries

#### Dev 3: Streaming UI & Tool Indicators ✅

**Files modified:**
- [x] `frontend/src/api/chat.ts` - Added `streamChatMessage()` async generator
- [x] `frontend/src/components/chat/MessageList.tsx` - Streaming cursor, tool display
- [x] `frontend/src/components/chat/ToolCallIndicator.tsx` - New component
- [x] `frontend/src/components/chat/ChatPanel.tsx` - Uses streaming API
- [x] `frontend/src/types/chat.ts` - Updated event types

**Tasks:**
- [x] Update API client to handle SSE
- [x] Add streaming text display with typing cursor
- [x] Create `ToolCallIndicator.tsx` showing tool status with timing
- [x] Show tool calls inline with messages (expandable details)

---

### Phase 3: Context & Intelligence 🟡 PARTIAL

**Goal**: Case-aware conversations, better prompts, persistence

#### Dev 1: System Prompt & Context

**Tasks:**
- [x] Create dynamic system prompt with current date/time
- [x] Include case context when `case_context` provided
- [ ] Fetch full case details for richer context
- [ ] Add conversation summarization for long histories

#### Dev 2: Smart Tool Selection

**Tasks:**
- [ ] Group tools by category for better Claude understanding
- [ ] Add examples to tool descriptions
- [ ] Create tool aliases/shortcuts

#### Dev 3: Context Integration & Persistence

**Tasks:**
- [x] Pass case context from current route
- [x] Show context indicator in ChatPanel ("General Chat" vs "Case #X")
- [x] New conversation button
- [ ] Create `useChat` hook for state management
- [ ] Persist conversations to localStorage
- [ ] Show conversation history / switch between conversations

---

### Phase 4: Integration & Polish 🟡 PARTIAL

**Goal**: Final integration, testing, polish

#### Integration ✅
- [x] Route registration in `routes/__init__.py`
- [x] ChatButton added to Layout.tsx
- [x] Browser test automation framework created (`tests/browser/`)

#### Polish Items:
- [ ] Keyboard shortcut to open chat (Cmd+K or Cmd+/)
- [ ] Mobile responsive design
- [ ] Error recovery (retry failed messages)
- [ ] Rate limiting
- [x] Message timestamps
- [ ] Copy message content
- [ ] Markdown rendering in responses
- [ ] Code syntax highlighting (for any code in responses)

---

## File Structure (Current)

```
services/
└── chat/
    ├── __init__.py          ✅ Exports: ChatClient, execute_tool, get_tool_definitions
    ├── types.py             ✅ Shared types: ToolCall, ToolResult
    ├── client.py            ✅ Claude API integration
    ├── tools.py             ✅ Tool registry and schema generation
    └── executor.py          ✅ Tool execution

routes/
└── chat.py                  ✅ POST /api/v1/chat endpoint

frontend/src/
├── api/
│   └── chat.ts              ✅ API client (snake_case conversion for backend)
├── types/
│   └── chat.ts              ✅ TypeScript interfaces
├── hooks/
│   └── useChat.ts           ⬜ Chat state management hook (not created)
└── components/
    └── chat/
        ├── index.ts         ✅ Barrel export
        ├── ChatButton.tsx   ✅ Floating action button
        ├── ChatPanel.tsx    ✅ Main chat drawer
        ├── MessageList.tsx  ✅ Message display with tool indicators
        ├── ChatInput.tsx    ✅ Input field
        └── ToolCallIndicator.tsx  ✅ Tool execution display

tests/
└── browser/                 ✅ Puppeteer test automation framework
    ├── lib/
    │   ├── TestRunner.js    ✅ Browser automation utilities
    │   └── PdfGenerator.js  ✅ PDF report generation
    └── scenarios/
        └── chat-test.js     ✅ Chat feature test scenario
```

---

## Environment Variables

Add to `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
CHAT_MODEL=claude-sonnet-4-20250514  # or claude-3-haiku for cost savings
CHAT_MAX_TOKENS=4096
```

---

## Security Considerations

1. **Authentication**: ✅ Chat endpoint requires same auth as other API endpoints
2. **Rate limiting**: ⬜ Limit requests per user (e.g., 20/minute)
3. **Tool permissions**: ✅ All tools require authentication; no anonymous access
4. **Input sanitization**: ⬜ Validate message content length and format
5. **Audit logging**: ⬜ Log all tool executions with user ID and timestamp
6. **Cost controls**: ⬜ Set max tokens, monitor API usage

---

## Testing Strategy

### Unit Tests
- [ ] `test_chat_client.py`: Mock Claude API responses
- [ ] `test_tool_executor.py`: Test each tool execution
- [ ] `test_tool_definitions.py`: Validate tool schemas

### Integration Tests
- [ ] `test_chat_endpoint.py`: Full request/response cycle
- [ ] `test_chat_streaming.py`: SSE event parsing

### E2E Tests
- [x] Browser automation framework (`tests/browser/`)
- [x] Chat test scenario with PDF report generation

---

## Future Enhancements

### Date Calculator MCP Tool

Add a dedicated date calculation tool for reliable date operations. While Claude handles simple date math well, a tool ensures accuracy for:

- **Business day calculations**: "Move deadline out 10 business days" (excludes weekends, optionally holidays)
- **Relative date parsing**: "The Friday after next" → exact ISO date
- **Court deadline calculations**: Jurisdiction-specific rules (e.g., CA Code of Civil Procedure deadlines)
- **Date range queries**: "What's 45 days before the trial date?"

**Proposed tool interface:**
```python
@mcp.tool()
def date_calculator(
    operation: str,  # "add", "subtract", "next_weekday", "business_days"
    base_date: str | None = None,  # ISO format, defaults to today
    days: int | None = None,
    weeks: int | None = None,
    months: int | None = None,
    weekday: str | None = None,  # "monday", "friday", etc.
    business_days_only: bool = False,
    exclude_holidays: bool = False
) -> dict:
    """
    Perform date calculations with guaranteed accuracy.

    Examples:
    - date_calculator(operation="add", days=43) → 43 days from today
    - date_calculator(operation="next_weekday", weekday="friday", weeks=2) → Friday after next
    - date_calculator(operation="add", business_days_only=True, days=10) → 10 business days
    """
```

**Priority**: Medium - Current system prompt includes date/time, but tool adds precision for legal deadlines.
