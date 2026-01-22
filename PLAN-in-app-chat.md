# Plan: In-App Natural Language Chat Interface

## Overview

Add a chat interface directly into the Galipo app that allows users to interact with case data using natural language. The backend would call the Claude API with the existing MCP tool definitions, enabling conversational access to all current functionality.

## Why This Makes Sense

### Current State
- MCP server exposes 35 tools for case/task/deadline/person management
- Users interact via external MCP clients (Claude Code, etc.)
- Context switching required between app UI and chat interface

### Benefits of In-App Chat

**Better Context Awareness**
- Chat knows which page/case the user is viewing
- Can pass current UI state (selected case, visible tasks, etc.) as context
- Responses can reference what's on screen: "the third task in your list"

**Lower Friction**
- No need to describe which case you're talking about—it's already on screen
- Quick interactions without leaving the app
- Coworkers don't need MCP client setup

**Richer Interactions**
- Could highlight items being discussed
- Show inline confirmations before destructive actions
- Animate changes as they happen

**Middle-Ground Approach**
- Keep MCP server for power users, automation, external integrations
- Add in-app chat as a convenience layer
- Same underlying tool logic, two entry points

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  Chat UI    │    │  Page View  │    │  React Query    │  │
│  │  Component  │───▶│  Context    │    │  Cache          │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                                       ▲            │
│         ▼                                       │            │
│  ┌─────────────────────────────────────────────┐│            │
│  │         POST /api/v1/chat (streaming)       ││            │
│  └─────────────────────────────────────────────┘│            │
└─────────────────────────────────────────────────│────────────┘
                          │                       │
                          ▼                       │
┌─────────────────────────────────────────────────│────────────┐
│                        Backend                  │            │
│  ┌─────────────┐    ┌─────────────┐    ┌───────┴─────────┐  │
│  │  /chat      │───▶│  Claude API │───▶│  Existing MCP   │  │
│  │  endpoint   │    │  (tools)    │    │  Tool Functions │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                              │
│  MCP Server (unchanged) ────────────────────────────────────│
└─────────────────────────────────────────────────────────────┘
```

### Backend Changes

**New endpoint: `POST /api/v1/chat`**
```python
@app.post("/api/v1/chat")
async def chat(request: Request):
    """
    Accepts: { message: str, context: { page, case_id?, ... }, history: [] }
    Returns: Streaming response (SSE or chunked)
    """
    # 1. Build system prompt with current context
    # 2. Convert MCP tool definitions to Claude tool format
    # 3. Call Claude API with streaming
    # 4. Execute tool calls against existing tool functions
    # 5. Stream response back to client
```

**Tool Integration**
- Reuse existing functions from `tools.py`
- Create a thin wrapper that converts Claude tool calls to direct function calls
- No MCP protocol overhead for in-app chat path

**Dependencies to Add**
- `anthropic` Python SDK for Claude API calls
- Environment variable: `ANTHROPIC_API_KEY`

### Frontend Changes

**New Components**
```
/components/chat/
├── ChatButton.tsx      # Floating button to open chat
├── ChatPanel.tsx       # Slide-out or modal chat panel
├── ChatMessage.tsx     # Individual message bubble
├── ChatInput.tsx       # Text input with send button
└── ChatContext.tsx     # Context provider for chat state
```

**Chat Panel Behavior**
- Floating button in bottom-right corner
- Opens slide-out panel (doesn't cover main content)
- Persists conversation within session
- Automatically includes current page context

**Context Passing**
```typescript
interface ChatContext {
  currentPage: 'dashboard' | 'cases' | 'case-detail' | 'tasks' | 'deadlines';
  caseId?: number;        // If viewing a specific case
  selectedItems?: number[]; // If items are selected
}
```

**Streaming UI**
- Show typing indicator while waiting
- Stream response text as it arrives
- Show tool execution status (e.g., "Creating task...")
- Invalidate React Query cache after mutations

### Database Changes (Optional)

Could add conversation persistence:
```sql
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'user' | 'assistant'
    content TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

For internal team use, in-memory conversation history per session might be sufficient.

## Implementation Phases

### Phase 1: Backend Chat Endpoint
- [ ] Add `/api/v1/chat` endpoint with Claude API integration
- [ ] Create tool wrapper to call existing tool functions
- [ ] Implement streaming response
- [ ] Add system prompt with context awareness

### Phase 2: Basic Chat UI
- [ ] ChatButton component (floating action button)
- [ ] ChatPanel with message history
- [ ] ChatInput with send functionality
- [ ] Basic streaming text display

### Phase 3: Context Integration
- [ ] Pass current page/case context to backend
- [ ] Include relevant data in system prompt (current case info, etc.)
- [ ] Invalidate React Query cache after tool mutations

### Phase 4: Polish
- [ ] Tool execution indicators
- [ ] Error handling and retry
- [ ] Keyboard shortcuts (Cmd+K to open?)
- [ ] Mobile responsiveness

## Considerations

### Cost Management
- Claude API costs per request
- For internal team, likely low volume
- Could add simple rate limiting if needed

### What Chat Should/Shouldn't Do
- **Good for**: Quick queries, creating/updating items, searching
- **Maybe not for**: Bulk operations, complex multi-step workflows
- Could scope available tools per page context

### MCP Server Unchanged
- External MCP clients continue to work
- No changes to existing tool definitions
- Chat is additive, not replacing anything

## Open Questions

1. **Conversation persistence**: Store in DB or just in-memory per session?
2. **Tool scoping**: Show all tools or filter by current page context?
3. **Multi-turn context**: How much conversation history to include?
4. **Error handling**: How to surface tool failures gracefully?

## Alternatives Considered

**Embed Claude chat widget**: Third-party solutions exist but wouldn't have access to our tools.

**Use MCP directly from frontend**: Would require exposing MCP server to browser, adds complexity.

**No chat, just keep MCP**: Works but requires context switching and more friction for quick tasks.

---

*This plan outlines a possible feature. Implementation is not committed.*
