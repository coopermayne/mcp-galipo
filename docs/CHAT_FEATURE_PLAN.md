# In-App AI Chat Feature Implementation Plan

## Overview

Add a natural language chat interface that allows users to interact with the case management system through conversation. The AI assistant (Claude) has access to all existing MCP tools and can:
- Answer questions about cases, tasks, deadlines, contacts
- Create/update data (add notes, schedule events, create tasks)
- Ask clarifying questions when information is missing

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

## Parallel Development Strategy

Three developers can work simultaneously with minimal merge conflicts by owning distinct file sets:

| Developer | Focus Area | Files Owned | Dependencies |
|-----------|------------|-------------|--------------|
| **Dev 1** | Backend: Chat API & Claude Client | `services/chat/client.py`, `services/chat/types.py`, `routes/chat.py` | None (uses contracts) |
| **Dev 2** | Backend: Tool Registry & Executor | `services/chat/tools.py`, `services/chat/executor.py`, `services/chat/__init__.py` | None (uses contracts) |
| **Dev 3** | Frontend: Chat UI | `frontend/src/components/chat/*`, `frontend/src/api/chat.ts`, `frontend/src/types/chat.ts` | None (uses contracts) |

### Shared Contracts (Define First!)

Before parallel work begins, all developers agree on these interfaces:

```python
# services/chat/types.py - DEFINE THIS FIRST (Dev 1 creates, all review)

from dataclasses import dataclass
from typing import Optional, Literal
from enum import Enum

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL_RESULT = "tool_result"

@dataclass
class ChatMessage:
    role: MessageRole
    content: str
    tool_use_id: Optional[str] = None
    tool_name: Optional[str] = None

@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict

@dataclass
class ChatRequest:
    message: str
    conversation_id: Optional[str] = None
    case_context: Optional[int] = None  # case_id if viewing a case

@dataclass
class ChatResponse:
    content: str
    conversation_id: str
    tool_calls: list[ToolCall] | None = None
    finished: bool = True
```

```typescript
// frontend/src/types/chat.ts - DEFINE THIS FIRST (Dev 3 creates, all review)

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  caseContext?: number;
}

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}
```

### Integration Points (Phase 4)

These existing files need minimal changes at the end:

| File | Change | Owner |
|------|--------|-------|
| `main.py` | Add `from routes.chat import register_chat_routes` + call it | Dev 1 |
| `frontend/src/components/layout/Layout.tsx` | Add `<ChatButton />` | Dev 3 |
| `frontend/src/api/index.ts` | Export chat functions | Dev 3 |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Basic working chat with tool execution (no streaming)

#### Dev 1: Backend Chat API & Claude Client

**Files to create:**
- `services/chat/__init__.py`
- `services/chat/types.py` (shared contract - create first, get team review)
- `services/chat/client.py`
- `routes/chat.py`

**Tasks:**
1. Create `services/chat/types.py` with dataclasses for messages, requests, responses
2. Create `services/chat/client.py`:
   - `ChatClient` class wrapping Anthropic SDK
   - `send_message(messages, tools, system_prompt)` method
   - Handle Claude API response parsing
   - Extract tool calls from response
3. Create `routes/chat.py`:
   - `POST /api/v1/chat` endpoint
   - Accept `ChatRequest` JSON body
   - Return `ChatResponse` JSON
   - Wire up to ChatClient and ToolExecutor (import from Dev 2)
4. Add conversation history storage (in-memory dict for Phase 1)

**Acceptance criteria:**
- Can send message to endpoint and get Claude response
- Tool calls are extracted and returned in response
- Conversation history maintained across messages

#### Dev 2: Backend Tool Registry & Executor

**Files to create:**
- `services/chat/tools.py`
- `services/chat/executor.py`

**Tasks:**
1. Create `services/chat/tools.py`:
   - `get_tool_definitions()` - returns list of tools in Claude format
   - Parse existing MCP tool decorators to extract:
     - Tool name
     - Description (from docstring)
     - Parameters (from function signature + type hints)
   - Format as Claude tool schema:
     ```python
     {
       "name": "get_case",
       "description": "Get full details for a specific case...",
       "input_schema": {
         "type": "object",
         "properties": {
           "case_id": {"type": "integer", "description": "..."},
           "case_name": {"type": "string", "description": "..."}
         }
       }
     }
     ```
2. Create `services/chat/executor.py`:
   - `execute_tool(name: str, arguments: dict) -> dict`
   - Map tool names to actual functions in `db/*`
   - Handle errors gracefully (return error dict, don't crash)
   - Log tool executions for debugging

**Acceptance criteria:**
- `get_tool_definitions()` returns valid Claude tool schemas for all 41 tools
- `execute_tool("get_case", {"case_id": 1})` returns case data
- Errors return structured error response, not exceptions

#### Dev 3: Frontend Chat UI

**Files to create:**
- `frontend/src/types/chat.ts` (shared contract - create first, get team review)
- `frontend/src/api/chat.ts`
- `frontend/src/components/chat/ChatButton.tsx`
- `frontend/src/components/chat/ChatPanel.tsx`
- `frontend/src/components/chat/MessageList.tsx`
- `frontend/src/components/chat/ChatInput.tsx`
- `frontend/src/components/chat/index.ts`

**Tasks:**
1. Create TypeScript types in `types/chat.ts`
2. Create `api/chat.ts`:
   - `sendMessage(request: ChatRequest): Promise<ChatResponse>`
   - Handle auth headers
3. Create `ChatButton.tsx`:
   - Floating action button (bottom-right corner)
   - Click opens ChatPanel
   - Badge for unread/pending state (future)
4. Create `ChatPanel.tsx`:
   - Slide-out drawer (right side, ~400px wide)
   - Contains MessageList + ChatInput
   - Close button
   - Manages conversation state with useState
5. Create `MessageList.tsx`:
   - Renders list of ChatMessage
   - User messages right-aligned, assistant left-aligned
   - Auto-scroll to bottom on new messages
6. Create `ChatInput.tsx`:
   - Text input + send button
   - Submit on Enter (Shift+Enter for newline)
   - Disable while waiting for response

**Acceptance criteria:**
- Chat button visible on all pages
- Can open/close chat panel
- Can send message and see response
- Messages persist in panel during session

---

### Phase 2: Streaming & Tool Visualization (Week 2)

**Goal**: Real-time streaming responses, visual feedback for tool execution

#### Dev 1: Streaming Response

**Changes to:**
- `services/chat/client.py`
- `routes/chat.py`

**Tasks:**
1. Update `ChatClient` to use streaming API:
   ```python
   with client.messages.stream(...) as stream:
       for event in stream:
           yield event
   ```
2. Update `/api/v1/chat` to return SSE stream:
   - `Content-Type: text/event-stream`
   - Events: `text`, `tool_use`, `tool_result`, `done`, `error`
3. Handle tool execution mid-stream:
   - When Claude requests tool, pause stream
   - Execute tool
   - Send tool_result event
   - Continue stream with Claude's follow-up

#### Dev 2: Tool Result Formatting

**Changes to:**
- `services/chat/executor.py`

**Tasks:**
1. Add result summarization for large responses:
   - Truncate if > 4000 chars
   - Add "X more items..." for lists
2. Add timing information to tool results
3. Create human-readable tool execution summaries:
   - "Retrieved case: Martinez v. City of Los Angeles"
   - "Created task: File MSJ response (due Jan 30)"

#### Dev 3: Streaming UI & Tool Indicators

**Changes to:**
- `frontend/src/api/chat.ts`
- `frontend/src/components/chat/MessageList.tsx`
- New: `frontend/src/components/chat/ToolCallIndicator.tsx`

**Tasks:**
1. Update API client to handle SSE:
   ```typescript
   async function* streamChat(request: ChatRequest): AsyncGenerator<StreamEvent>
   ```
2. Add streaming text display:
   - Show partial message as it arrives
   - Typing cursor animation
3. Create `ToolCallIndicator.tsx`:
   - Shows tool name and status (pending/running/done)
   - Expandable to show arguments and result
   - Loading spinner while executing
4. Update MessageList to show tool calls inline with messages

---

### Phase 3: Context & Intelligence (Week 3)

**Goal**: Case-aware conversations, better prompts, persistence

#### Dev 1: System Prompt & Context

**Changes to:**
- `services/chat/client.py`
- `routes/chat.py`

**Tasks:**
1. Create dynamic system prompt:
   ```
   You are an AI assistant for Galipo, a legal case management system.
   You help attorneys manage personal injury cases.

   Current context:
   - User is viewing case: {case_name} (ID: {case_id})
   - Case status: {status}
   - Upcoming deadlines: {deadlines}

   Available actions:
   - Query case information
   - Add notes, tasks, events
   - Update case status
   - Search for persons/contacts

   When asked to do something that requires missing information,
   ask clarifying questions before proceeding.
   ```
2. Fetch case context when `case_context` provided in request
3. Add conversation summarization for long histories

#### Dev 2: Smart Tool Selection

**Changes to:**
- `services/chat/tools.py`

**Tasks:**
1. Group tools by category for better Claude understanding
2. Add examples to tool descriptions:
   - "Example: add_note(case_id=5, content='Client called re: settlement')"
3. Create tool aliases/shortcuts:
   - "add note" → `add_note`
   - "schedule hearing" → `create_event`

#### Dev 3: Context Integration & Persistence

**Changes to:**
- `frontend/src/components/chat/ChatPanel.tsx`
- New: `frontend/src/hooks/useChat.ts`

**Tasks:**
1. Create `useChat` hook:
   - Manages conversation state
   - Persists to localStorage
   - Clears on logout
2. Pass case context from current route:
   - If on `/cases/:id`, include `caseContext: id`
3. Show context indicator in ChatPanel:
   - "Chatting about: Martinez v. City of LA"
4. Add conversation history:
   - Show past conversations
   - Switch between conversations
   - New conversation button

---

### Phase 4: Integration & Polish (Week 4)

**Goal**: Final integration, testing, polish

#### All Devs: Integration

**Shared tasks:**
1. Dev 1: Add route registration to `main.py`
2. Dev 3: Add ChatButton to Layout.tsx
3. All: End-to-end testing
4. All: Bug fixes and polish

#### Polish Items:
- [ ] Keyboard shortcut to open chat (Cmd+K or Cmd+/)
- [ ] Mobile responsive design
- [ ] Error recovery (retry failed messages)
- [ ] Rate limiting
- [ ] Message timestamps
- [ ] Copy message content
- [ ] Markdown rendering in responses
- [ ] Code syntax highlighting (for any code in responses)

---

## File Structure (Final)

```
services/
└── chat/
    ├── __init__.py          # Exports: ChatClient, execute_tool, get_tool_definitions
    ├── types.py             # Shared types: ChatMessage, ChatRequest, ChatResponse
    ├── client.py            # Claude API integration
    ├── tools.py             # Tool registry and schema generation
    └── executor.py          # Tool execution

routes/
└── chat.py                  # POST /api/v1/chat endpoint

frontend/src/
├── api/
│   └── chat.ts              # API client for chat endpoint
├── types/
│   └── chat.ts              # TypeScript interfaces
├── hooks/
│   └── useChat.ts           # Chat state management hook
└── components/
    └── chat/
        ├── index.ts         # Barrel export
        ├── ChatButton.tsx   # Floating action button
        ├── ChatPanel.tsx    # Main chat drawer
        ├── MessageList.tsx  # Message display
        ├── ChatInput.tsx    # Input field
        └── ToolCallIndicator.tsx  # Tool execution display
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

1. **Authentication**: Chat endpoint requires same auth as other API endpoints
2. **Rate limiting**: Limit requests per user (e.g., 20/minute)
3. **Tool permissions**: All tools require authentication; no anonymous access
4. **Input sanitization**: Validate message content length and format
5. **Audit logging**: Log all tool executions with user ID and timestamp
6. **Cost controls**: Set max tokens, monitor API usage

---

## Testing Strategy

### Unit Tests
- `test_chat_client.py`: Mock Claude API responses
- `test_tool_executor.py`: Test each tool execution
- `test_tool_definitions.py`: Validate tool schemas

### Integration Tests
- `test_chat_endpoint.py`: Full request/response cycle
- `test_chat_streaming.py`: SSE event parsing

### Frontend Tests
- Component tests with React Testing Library
- E2E tests with Playwright:
  - Open chat, send message, verify response
  - Tool execution flow
  - Error handling

---

## Rollout Plan

1. **Internal testing**: Deploy to staging, team tests for 1 week
2. **Feature flag**: Add `ENABLE_CHAT=true` environment variable
3. **Gradual rollout**: Enable for select users first
4. **Monitor**: Track API costs, error rates, user feedback
5. **Full release**: Enable for all users

---

## Success Metrics

- **Adoption**: % of users who use chat feature
- **Task completion**: % of requests that result in successful tool execution
- **Conversation depth**: Average messages per conversation
- **Error rate**: % of failed requests
- **Cost**: Average API cost per conversation

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
