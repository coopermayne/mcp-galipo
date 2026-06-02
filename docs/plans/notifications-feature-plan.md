# Notifications + @-Mentions — Feature Plan

**Status:** Planned. **Hard prerequisite:** GitHub issue #102 (comment-system unification) must be implemented first.
**Channel (this version):** In-app only (notification bell + real-time SSE). No email/SMS.
**Recipients:** Internal team only — the `users` table. (`persons` are contacts and have no login.)

---

## 1. Goal

Two ways a team member gets notified:

1. **@-mention** — someone `@`-mentions them in an activity-log comment (case, intake, task — and event once it has an activity log).
2. **Task assignment** — someone sets/changes a task's `assignee_id` to them.

Notifications appear in a **bell dropdown** in the app header with a live unread badge, updating in real time over the existing SSE stream. Clicking a notification marks it read and navigates to the source entity.

---

## 2. Why #102 is a hard prerequisite

Today comments are written through **three different backends** (see issue #102):

| Surface | Endpoint | Backend |
|---|---|---|
| Task feed | `/api/v1/comments/{type}/{id}` | polymorphic `comments` |
| Dale | `/api/v1/dale/comments/...` | polymorphic `comments` |
| Case feed | `/api/v1/cases/{id}/comments` | old `case_comments` |
| Intake feed | `/api/v1/intakes/{id}/comments` | old `intake_comments` |

If we add the mention trigger now, we'd wire it into **three** create-comment paths. After #102, every comment flows through `routes/comments.py → api_create_comment` ([routes/comments.py:81](../../routes/comments.py)), so the mention trigger lives in **one** place. Do #102 first.

---

## 3. Scope decisions (locked for v1)

- **In-app only.** No outbound email/SMS exists in the codebase (Twilio is inbound-only); adding it is a separate project. Bell + SSE reuses everything we already have.
- **Recipients = `users`** (internal team). Mentioning a `person` is not supported.
- **Mentionable list = `GET /api/v1/staff`** ([routes/users.py:86](../../routes/users.py)), already consumed by `getStaff()` ([frontend/src/services/staff.ts](../../frontend/src/services/staff.ts)).
- **No new MCP tools** → no `MCP_INSTRUCTIONS` change, no chat-mode change.
- **No Dockerfile change** — new files live inside `db/` and `routes/`, which are copied as whole directories (`COPY db/ ./db/`, `COPY routes/ ./routes/`). The per-file COPY list is only for root-level modules.
- **Single-worker constraint respected.** The SSE user→queue registry is in-memory, consistent with the existing `-w 1` deploy (same constraint as MCP OAuth). Horizontal scale would require a shared pub/sub — out of scope and already a known limitation.

---

## 4. Data model

New table `notifications` (add `Notification` model to [models.py](../../models.py), generate Alembic migration).

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `recipient_user_id` | int, FK `users.id` **ON DELETE CASCADE**, indexed | who sees it |
| `actor_user_id` | int, FK `users.id` **ON DELETE SET NULL**, nullable | who caused it |
| `type` | String(30) | `"mention"` \| `"task_assigned"` (extensible) |
| `entity_type` | String(50) | navigation target: `"case"`,`"intake"`,`"task"`,`"event"` |
| `entity_id` | int | target id |
| `comment_id` | int, FK `comments.id` **ON DELETE CASCADE**, nullable | set for `mention` (for scroll-to / cleanup) |
| `message` | Text | denormalized summary, e.g. `"Alex Kim mentioned you on Smith v. Jones"` |
| `read_at` | `DateTime(timezone=True)`, nullable | `NULL` = unread |
| `created_at` | `DateTime(timezone=True)`, server default `func.now()` | |

Indexes: `(recipient_user_id, read_at)` for unread counts; `(recipient_user_id, created_at DESC)` for the list.

All datetimes UTC (see CLAUDE.md timezone rules). Follow the existing Alembic flow: edit `models.py` → `alembic revision --autogenerate -m "add notifications table"` → review → `alembic upgrade head`.

---

## 5. Backend

### 5.1 `db/notifications.py` (new — no Dockerfile change)

```python
create_notification(recipient_user_id, type, entity_type, entity_id, message,
                    actor_user_id=None, comment_id=None) -> dict | None
    # returns None (no-op) if recipient_user_id == actor_user_id  (no self-notify)

list_notifications(user_id, limit=30, before_id=None, unread_only=False) -> list[dict]
get_unread_count(user_id) -> int
mark_read(notification_id, user_id) -> None        # scoped to recipient
mark_all_read(user_id) -> None
```

Use `SessionLocal()` context manager (project convention). Dict shape mirrors `_comment_to_dict` — include actor name/initials via `joinedload` for the dropdown avatar.

### 5.2 `routes/notifications.py` (new)

```
GET  /api/v1/notifications?limit=30&unread_only=false   -> {notifications: [...], unread_count: N}
GET  /api/v1/notifications/unread-count                 -> {count: N}
POST /api/v1/notifications/{id}/read                    -> {success: true}
POST /api/v1/notifications/read-all                     -> {success: true}
```

- Gate every handler with `auth.require_auth` + `auth.get_current_user`; resolve `user_id` via the `_get_db_user_id` helper pattern ([routes/comments.py:21](../../routes/comments.py)).
- **Recipient scoping enforced server-side** — a user can only read/mark their own notifications.
- Register in [routes/__init__.py](../../routes/__init__.py): add `from .notifications import register_notification_routes` and call it **before** `register_static_routes` (static catch-all must stay last).

### 5.3 SSE per-user targeting ([routes/sse.py](../../routes/sse.py))

Today `broadcast()` fans out to **all** clients and `add_client()` has no user identity. Add targeted delivery:

- Track identity: replace `_clients: set[Queue]` with a registry keyed by user, e.g. `_user_queues: dict[int, set[Queue]]` (plus keep an all-set for `broadcast`). `add_client(user_id)` / `remove_client(queue)` maintain both.
- New `send_to_user(user_id: int, event: dict)` — enqueue only to that user's queues.
- In the stream route ([routes/sse.py:74](../../routes/sse.py)): after validating the token, resolve the user with **`auth.get_session_user(token)`** ([auth.py:162](../../auth.py)) and pass `user["id"]` to `add_client`.
- `broadcast()` stays for entity invalidation events; `send_to_user()` is for notifications.

**Avoid the self-skip pitfall:** `use-sse.ts` drops events where `event.user_id === currentUser.id` ([frontend/src/hooks/use-sse.ts:45](../../frontend/src/hooks/use-sse.ts)). So the notification SSE payload must **not** carry the actor's id as `user_id`. Emit:
```python
send_to_user(recipient_id, {"entity": "notification", "action": "created"})
```
(no `user_id` key). Since we already skip self-notifications, the recipient is never the actor.

### 5.4 Trigger A — mentions (in `api_create_comment`, [routes/comments.py:97](../../routes/comments.py))

After `add_comment(...)` + the existing `broadcast(...)`:

1. Parse `data.content` for mention tokens (format below): regex `@\[[^\]]+\]\(user:(\d+)\)`.
2. Dedupe ids; drop the author's own id.
3. For each remaining id: `create_notification(type="mention", entity_type=entity_type, entity_id=entity_id, comment_id=comment["id"], actor_user_id=author_id, message=...)` then `send_to_user(recipient_id, {...})`.

**Mention storage format:** store the token **inline in `content`**: `@[Display Name](user:42)`. Rationale: self-contained (survives re-render, export, re-parse), no comment-API change (`CreateCommentInput` stays `{content}`), backend resolves recipients by regex. The frontend renders the token as a highlighted `@Name` (§6.3).

### 5.5 Trigger B — task assignment ([routes/tasks.py](../../routes/tasks.py))

- **Create** (~[routes/tasks.py:72](../../routes/tasks.py)): if `assignee_id` set and `!= actor`, create `type="task_assigned"`, `entity_type="task"`, `entity_id=task_id`, then `send_to_user`.
- **Update** (~[routes/tasks.py:160](../../routes/tasks.py)): only notify when the assignee **changes** to a new, non-actor user. Capture the previous `assignee_id` before `update_task_full` and compare — don't fire on unrelated edits or re-saves. (`db/tasks.py` already returns the assignee; read prior value first.)

### 5.6 No changes needed to

`tools.py`, `main.py` `MCP_INSTRUCTIONS`, chat modes (UI-only feature).

---

## 6. Frontend

### 6.1 `services/notifications.ts` + `types/notification.ts` (new)

`getNotifications(opts)`, `getUnreadCount()`, `markRead(id)`, `markAllRead()` via `apiFetch`. Type matches the backend dict (id, type, entity_type, entity_id, comment_id, message, read_at, created_at, actor_first_name/last_name/initials).

### 6.2 `MentionComposer` — `components/common/mention-composer.tsx` (new, the "build once" win)

A reusable composer that wraps the shadcn `Textarea` (the activity-log input today):

- Detects `@` + the query word at the caret.
- Anchors a dropdown at the caret — use `Combobox` ([components/ui/combobox.tsx](../../frontend/src/components/ui/combobox.tsx), has `useComboboxAnchor`) or `Command` (cmdk).
- Options from `useQuery(["staff"], getStaff)`, filtered by name.
- On select, inserts the token `@[First Last](user:ID)` and restores caret; renders the visible chip/highlight via §6.3 in the feed, not in the raw textarea (textarea shows the token text — acceptable for v1, or use a contenteditable later).
- `Enter` submits, `Shift+Enter` newline (match current behavior at [activity-feed.tsx:150](../../frontend/src/components/common/activity-feed.tsx)).
- Props: `onSubmit(content: string)`, `placeholder?`, `disabled?`.

Swap the inline `<Textarea>+Send` into `MentionComposer` in all three feeds:
- [activity-feed.tsx](../../frontend/src/components/common/activity-feed.tsx) (tasks/shared)
- [case-activity-feed.tsx](../../frontend/src/pages/cases/components/case-activity-feed.tsx)
- [intake-comments.tsx](../../frontend/src/pages/intakes/components/intake-comments.tsx)

### 6.3 Mention rendering helper — `lib/render-mentions.tsx` (new)

`renderWithMentions(content: string): ReactNode[]` — splits on the `@[Name](user:id)` token and renders each as a highlighted `<span>` (`text-primary font-medium`), plain text otherwise. Use it wherever a user comment body renders (the `UserCommentEntry` in each feed, e.g. [activity-feed.tsx:81](../../frontend/src/components/common/activity-feed.tsx)). **Also use it (or a strip-to-plain variant) in PDF/DOCX export and any AI/case-summary path** so the raw token never leaks into documents or model context.

### 6.4 Notification bell — `components/common/notification-bell.tsx`, mounted in [header.tsx](../../frontend/src/components/layout/header.tsx)

- Bell icon (Hugeicons) + unread-count badge (theme tokens, square corners per CLAUDE.md).
- `Popover` dropdown: `useQuery(["notifications"], () => getNotifications())`; each row = actor avatar + `message` + `timeAgo(created_at)` ([lib/datetime.ts](../../frontend/src/lib/datetime.ts)) + unread dot.
- Click row → `markRead(id)` (optimistic) → navigate to entity (§6.6).
- "Mark all read" button → `markAllRead()`.
- Unread count: `useQuery(["notifications","unread-count"], getUnreadCount)`.

### 6.5 SSE wiring

- [sse-invalidation-map.ts](../../frontend/src/lib/sse-invalidation-map.ts): add
  ```ts
  notification: () => [["notifications"], ["notifications", "unread-count"]],
  ```
- [types/sse.ts](../../frontend/src/types/sse.ts): ensure `"notification"` entity is allowed.
- Optional nicety: on a `notification` event, fire a `sonner` toast with the message.

### 6.6 Navigation targets

Map `entity_type` → route: `case` → `/cases/:id`, `intake` → `/intakes/:id`, `task`/`event` → their list view + open the detail dialog. Tasks/events open in **dialogs**, so deep-linking may need a `?task=ID` query param the page reads on mount — note as an implementation detail; for v1 it's acceptable to land on the entity and open the dialog if straightforward.

---

## 7. Build order

0. **#102 implemented** (prereq).
1. **Model + migration** (`notifications` table).
2. **`db/notifications.py` + `routes/notifications.py`** (+ registration).
3. **SSE per-user targeting** (`send_to_user`, identified `add_client`).
4. **Notification bell UI + services + SSE invalidation** — now the pipe is visible end-to-end.
5. **Trigger B: task assignment** — cheapest real producer (no input UI). Verify a notification arrives live.
6. **Trigger A + `MentionComposer` + render helper** — the @-mention half, layered on the working pipe.

Rationale: get a *visible* notification flowing (task assignment) before tackling the fiddlier mention-input UI.

---

## 8. Verification

Use the `test-as` skill to log in as two users (A and B), `/dev` for servers, Playwright for the UI:

- **Self-skip:** A assigns a task to A → no notification.
- **Task assign:** A assigns task to B → B's bell badge increments **live** (no refresh); A sees nothing.
- **Mention:** A posts a case comment `... @[B](user:idB) ...` → B notified; comment renders `@B` highlighted; A not notified.
- **Dedupe:** mention B twice in one comment → one notification.
- **Assignee no-op:** edit a task without changing assignee → no new notification.
- **Read:** B clicks the notification → badge clears, navigates to the case and (ideally) scrolls to the comment.
- **Cross-user isolation:** B's SSE stream never receives A's notifications.
- Run `/verify` before committing (DB-safe migration check).

---

## 9. Risks / edge cases

| Risk | Handling |
|---|---|
| Duplicate notifications on comment edit | Comments have no edit endpoint today; only fire on create. Revisit if editing is added. |
| Mention token leaks into exports / AI context | Strip/render via §6.3 in export + summary paths. |
| Self-mention / self-assign | Skipped in `create_notification`. |
| Deleted comment/entity | `comment_id` CASCADE; dangling entity target → click shows a toast, no crash. |
| Recipient user deleted | `recipient_user_id` CASCADE. |
| SSE only in-memory (`-w 1`) | Matches existing deploy constraint; documented limitation. |
| Token format collision in normal text | The `@[..](user:\d+)` pattern is unlikely to occur naturally; regex is specific. |

---

## 10. Open questions for Cooper

1. **Dedicated `/notifications` page** in addition to the dropdown, or dropdown-only for v1?
2. **Email/SMS escalation** later (e.g., for mentions when offline)? Out of scope now — confirm.
3. **Events activity log:** events have no activity feed yet. Add `<ActivityFeed entityType="event" .../>` to the event dialog as part of this work, or defer mentions-in-events?
4. **Mark-read semantics:** does opening the bell dropdown mark everything seen, or only on click-through? (Plan assumes click-through + explicit "mark all read".)
5. **Mentions in "Pinned Info" (`Case.notes`)?** Out of scope (notes ≠ comments) — confirm.
