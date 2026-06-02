# Implementation Plan — Work Log (Voice-Driven Activity Logging)

> **Status:** Ready to implement. Developed against the current codebase (branch
> `claude/voice-log-case-contact-Qgp6Y`) with all file paths, patterns, and the current
> Alembic head verified. Hand this to a local Claude session that has the database,
> Python deps, and dev servers available.

---

## 1. The Feature (what we're building and why)

The user (an attorney) wants to record a short, **stream-of-consciousness memo once or
twice a day** describing what they worked on — *"I spent the morning on the opposition
to the motion to dismiss in the Armstrong case, then had a call with Tanner Navaroli
about the Reyes matter, then drafted discovery for Armstrong again."* — and have it
turned into discrete, time-estimated **work-log entries** linked to cases (and people).

Crucially, **the system already knows about a lot of the day's work** — calendared
events (depositions, hearings), tasks completed/updated that day, and calls logged in the
activity feed. So instead of making the user re-describe those, the system **surfaces
them for one-tap selection**. The user only free-types what *isn't* already captured.

Later, the user can open a **case** and see everything they did on it, by day, with a
rough time total — and open a **contact** and see every interaction with that person.

### Design philosophy (these shape every decision)

- **This is NOT a time tracker.** No start/stop, no 10:00–11:00 precision. The goal is
  *broad strokes* — a low-effort habit that yields a rough sense of effort per case.
- **Never make the user re-describe what's already in the system.** Surface it; let them
  select it.
- **No nitpicky follow-up questions.** The AI estimates durations from context. It never
  interrogates.
- **A realistic day, capped.** The AI consolidates everything into a believable **5–7
  working-hour day** and **never exceeds ~7 hours** total. It estimates task durations
  itself rather than using rigid per-item defaults.

---

## 2. The Three-Phase Flow (the core UX — resolved with the user)

The `/log` page walks through three phases. **Phase 3 can happen immediately after Phase
2, or be deferred to later** — so the consolidated result is **persisted as a draft** and
remains confirmable later.

### Phase 1 — Input
Two lanes that merge:
- **Surfaced items (multi-select):** a pre-built list of things already on record for the
  selected date — **events**, **completed/updated tasks**, and **case comments / activity-feed
  items** (calls *and* any other logged work — a comment usually reflects something that took
  time). Each is pre-filled with its case and description. The user just ticks the ones that
  represent real work-time.
- **Free-form writing:** a textarea for everything not already captured.

### Phase 2 — Consolidation (AI)
The AI receives the **selected surfaced items + the free-text memo + candidate
cases/contacts**, and in a single call:
1. **Splits** the memo into discrete activities (one activity = one case).
2. **Estimates durations** — including estimating **task** durations from their
   descriptions (not fixed defaults). Events with a real start/end time keep their actual
   length.
3. **Apportions a realistic working day** — total lands in **~5–7 hours** and **never
   exceeds 7 hours (420 min)**.
4. **Matches** each activity to a case and to people from the candidate lists; unmatched →
   `case_id = null` with the raw phrasing preserved.

The result is **saved as a draft** (`voice_logs.status = 'draft'`) and returned for review.

### Phase 3 — Confirmation
A **one-glance, editable** review: the user confirms/fixes case links, people, and
durations, then confirms. On confirm, the draft flips to `confirmed`. **Drafts not
confirmed remain in a "needs review" list** so confirmation can happen later. Only
**confirmed** entries count toward case/contact totals.

---

## 3. Design Decisions (resolved — do not re-litigate)

| Decision | Resolution |
|---|---|
| Fan-out | **One memo → many activities.** A single dump splits into N entries. |
| Activity ↔ case | **Each activity belongs to exactly one case** (or none → unmatched). |
| Time granularity | **Per-activity** `minutes`. Each entry has its own duration. |
| Activity ↔ people | **Many-to-many.** One activity can name several people. |
| Unknown names | **Preserve raw text, leave unlinked** (`case_id = null`, keep `raw_reference`/`case_guess`). |
| Surfaced items | **Multi-select** from events, completed/updated tasks, and case comments (activity-feed items) for the date — a comment usually reflects work that took time. Don't make the user re-describe them. |
| Link vs copy | **Link, don't copy.** A selected item becomes an entry that *references* its source via `source_type` + `source_id` (no duplication, no drift, no re-surfacing). Free-typed entries are `source_type = 'manual'`. |
| Time estimation | **AI estimates** (incl. task durations). Two-pass: split → estimate/apportion → match. |
| Day budget | **Target ~5–7 hrs; hard ceiling ~7 hrs.** Anchored items (events with real times) keep their length; flexible work absorbs the remainder. |
| Review | **One-glance, editable, non-blocking.** Unmatched entries still save fine. |
| Deferred confirm | **Consolidation persists a draft**; confirmation can happen now or later. Only confirmed entries count. |
| Audio | **Do NOT store audio.** Text only (phone dictation / paste). |
| Entry point | **Dedicated `/log` page + a global button in the app header.** |
| Naming | Domain = **`worklog`**. **Do NOT use `activity`** — already taken (see §4). |

---

## 4. Critical Codebase Facts (verified — saves rediscovery)

### Naming collision to avoid
`routes/activity.py` + `db/activity.py` + `register_activity_routes` already implement
**page-view analytics**. The frontend `CaseActivityFeed` is a **comment/system-event
feed** backed by `case_comments`. **Keep the new feature in a `worklog` namespace.**

### Where the "surfaced item" sources live (verified)
- **Events:** `events` table (`models.py` ~496). Filter by `date == log_date`. `event_type`,
  `time`, `end_date`, `description`, `case_id`, `attendee_ids`. DB module: `db/events.py`.
- **Tasks:** `tasks` table (`models.py` ~802). "Done today" = `completion_date == log_date`;
  also consider `status` changes via `updated_at::date == log_date`. DB module: `db/tasks.py`.
- **Case comments (the "comments" lane):** the activity feed is backed by `case_comments`
  (`db/case_comments.py`) — and a polymorphic `comments` table exists too (`db/comments.py`,
  `entity_type`/`entity_id`). **Treat user-authored (non-`is_system`) `case_comments` created
  on `log_date` as candidate work items** — a comment usually reflects something that took the
  user time (a call, a review, a follow-up). This is broader than "calls": any non-system
  comment is a legitimate candidate. (Note: structured *interactions* currently exist only for
  **intakes** — `intake_comments` with `detail={type:'interaction',...}` via
  `services/interaction_summarizer.py`; cases have no structured interaction type yet, so the
  generic comment is the right hook.) **Skip `is_system` comments** (they're auto-generated
  audit lines like "X added a note", not work). **Confirm exact source at implementation time.**

### Current Alembic head
- **Head: `d2cd156b344a`** (`alembic/versions/d2cd156b344a_add_alert_dismissals_table.py`).
  Single head, verified. Prefer `alembic revision --autogenerate` (you have a live DB),
  which sets `down_revision` automatically. Re-verify with `alembic heads`.

### Patterns to mirror (exact reference files)
- **Migration:** `alembic/versions/d2cd156b344a_add_alert_dismissals_table.py`
- **DB module:** `db/notes.py` — `SessionLocal()` ctx mgr, `_x_to_dict()` via the Out schema,
  `flush()/refresh()/commit()` order. Exports in `db/__init__.py` (import block ~168 + `__all__` ~524).
- **Routes:** `routes/notes.py` — `@mcp.custom_route(...)`, `auth.require_auth(request)`,
  `auth.get_current_user(request)`, `asyncio.to_thread(db.fn, ...)`, `pydantic_error(e)` /
  `api_error(...)` from `.common`. Register in `routes/__init__.py` **before**
  `register_static_routes(mcp)` (line 152); add to `__all__` (~156).
- **Input schemas:** `schemas/inputs.py` — plain `BaseModel`, no `__all__` (re-exported by
  `from .inputs import *`). **Output schemas:** `schemas/outputs.py` —
  `ConfigDict(from_attributes=True)`; `model_dump(mode="json")` ISO-formats datetimes.
  `NoteOut` (97–110) and `PersonOut` (357–369) are templates.
- **LLM extraction:** `services/case_extractor.py` — sync `anthropic.Anthropic`,
  `tool_choice={"type":"tool","name":...}` to FORCE structured output, read `block.input`,
  `db.token_usage.record_usage_from_message(source=..., request_type=..., model=..., message=...)`.
  Model = `settings.extraction_model` (`config.py`); key = `os.environ["ANTHROPIC_API_KEY"]`.
  Prompt-cache large candidate lists via the `cache_control` pattern in `services/chat/client.py`.
- **MCP tool:** `tools.py` `manage_note` (~1292) — `@mcp.tool()`, helpers `validation_error()`,
  `error_response()`, `not_found_error()`; `Context.case_context`. Registered in `register_tools(mcp)`.
- **MCP instructions:** `main.py` `MCP_INSTRUCTIONS` (~26–69, tools overview ~30–41) — hand-maintained.

### Frontend facts
- **Case detail:** `frontend/src/pages/cases/detail.tsx` renders `<CaseNotesPanel/>` and
  `<CaseActivityFeed caseId={...}/>` in a right column (~315). Mount the new Work Log card here.
- **Feed pattern:** `frontend/src/pages/cases/components/case-activity-feed.tsx` (TanStack Query + card).
- **Contact dialog:** `frontend/src/components/common/contact-detail-dialog.tsx` — add an
  "Interactions" section alongside contact-info / SMS / roles.
- **Service pattern:** `frontend/src/services/cases.ts` (`apiFetch` from `@/lib/api`).
  **Types:** `frontend/src/types/case.ts`. **Datetime helpers:** `frontend/src/lib/datetime.ts`
  (`formatDateHeader`, `getDateKey`).
- **Conventions:** `@/` imports; `kebab-case.tsx`; **square corners** (no `rounded-*`);
  semantic color tokens; **Hugeicons** (not Lucide); TanStack Query; React Hook Form + Zod;
  shadcn via `npx shadcn@latest add` (check APIs with the shadcn MCP + Context7).
- **Locate at implementation time:** the **router** (React Router v7 — likely
  `frontend/src/App.tsx` or a router file) for the `/log` route, and the **app header/sidebar**
  (`frontend/src/components/layout/`) for the global "Log my day" button.

---

## 5. Data Model

Three new tables + two reference columns. Prefer: edit `models.py`, then
`alembic revision --autogenerate -m "add worklog tables"` → review → `alembic upgrade head`.

### `voice_logs` — one row per session/brain-dump
| column | type | notes |
|---|---|---|
| `id` | Integer PK | |
| `transcript` | Text, nullable | the raw free-text (may be empty if the day was all surfaced items) |
| `log_date` | Date, not null | the date the work happened (defaults today, editable) |
| `status` | String(20), not null, default `'draft'` | `'draft'` \| `'confirmed'` |
| `created_by` | Integer FK→`users.id` SET NULL, nullable | who logged it |
| `created_at` | DateTime(tz=True), default CURRENT_TIMESTAMP | |
| `confirmed_at` | DateTime(tz=True), nullable | set when confirmed |

### `worklog_entries` — the consolidated, time-estimated activities
| column | type | notes |
|---|---|---|
| `id` | Integer PK | |
| `voice_log_id` | Integer FK→`voice_logs.id` CASCADE, not null | |
| `case_id` | Integer FK→`cases.id` SET NULL, **nullable** | NULL = unmatched |
| `minutes` | Integer, not null | AI estimate, user-adjustable |
| `description` | Text, not null | concise summary |
| `raw_reference` | Text, nullable | original phrase / case_guess (preserved, esp. unmatched) |
| `activity_date` | Date, not null | denormalized from `log_date` for per-case/day queries |
| `source_type` | String(20), nullable | `'manual'` \| `'event'` \| `'task'` \| `'comment'` |
| `source_id` | Integer, nullable | id of the linked event/task/case_comment (NULL for manual) |
| `created_at` | DateTime(tz=True), default CURRENT_TIMESTAMP | |

Indexes: `case_id`, `voice_log_id`, `activity_date`, `(source_type, source_id)`.

### `worklog_entry_people` — junction (entry ↔ persons, many-to-many)
| column | type | notes |
|---|---|---|
| `entry_id` | Integer FK→`worklog_entries.id` CASCADE | composite PK |
| `person_id` | Integer FK→`persons.id` CASCADE | composite PK |

Index: `person_id`.

**SQLAlchemy notes:** follow `models.py` conventions — `Mapped`/`mapped_column`,
`DateTime(timezone=True)` (UTC), `server_default=text("CURRENT_TIMESTAMP")`, explicit
`ForeignKeyConstraint`+`Index` in `__table_args__`, `relationship(..., passive_deletes=True)`.
Add a `worklog_entries` relationship to `Case`. Use `func.now()` / `datetime.now(timezone.utc)`.

---

## 6. Backend Implementation

### 6.1 `models.py`
Add `VoiceLog`, `WorklogEntry`, `WorklogEntryPerson` (§5) + a `Case.worklog_entries` relationship.

### 6.2 Migration
`alembic revision --autogenerate -m "add worklog tables"` → review → `alembic upgrade head`.

### 6.3 `db/worklog.py` (mirror `db/notes.py`)
```python
def get_worklog_candidates(log_date, user_id) -> dict
# Returns {"events":[...], "tasks":[...], "comments":[...]} for log_date,
# scoped to the user's cases (case.attorney_ids/paralegal_ids contains user_id; fall back to all).
# Each candidate: {source_type, source_id, case_id, case_name, short_name, description,
#                  anchored_minutes|None, when}. anchored_minutes derived from event time/end_date.
# events: db.events filtered date==log_date. tasks: completion_date==log_date (and/or
# updated_at::date==log_date with status terminal). comments: user-authored (NON-is_system)
# case_comments created on log_date — each is a candidate work item (refine filter per §4).

def create_worklog_draft(transcript, log_date, created_by, entries) -> dict
# Creates VoiceLog(status='draft') + WorklogEntry rows + people junction, ONE transaction.
# entries: [{case_id|None, minutes, description, raw_reference, source_type, source_id, person_ids}]

def get_worklog_draft(voice_log_id) -> dict | None        # for deferred confirmation
def list_worklog_drafts(user_id) -> list                  # "needs review"
def confirm_worklog(voice_log_id, entries) -> dict        # apply edits, status='confirmed', confirmed_at=now
def get_worklog_by_case(case_id) -> dict                  # confirmed only; entries + total minutes, grouped by date
def get_worklog_by_person(person_id) -> dict              # confirmed only; entries + case info
def update_worklog_entry(entry_id, **fields) -> dict|None # post-hoc edit (optional)
def delete_worklog_entry(entry_id) -> bool                # optional
def delete_worklog_draft(voice_log_id) -> bool            # discard an abandoned draft
```
`get_worklog_by_case`/`by_person` must filter to `voice_logs.status == 'confirmed'`.
Eager-load people + case names (`selectinload`/joins) to avoid N+1. Export in `db/__init__.py`.

### 6.4 `services/worklog_consolidator.py` (near-twin of `services/case_extractor.py`)
Inputs: `transcript`, `log_date`, the **selected surfaced items** (resolved to their
descriptions/anchored durations), and **candidate cases/contacts** (id + name; lean;
prompt-cache if large). Single forced tool `submit_worklog`:

```python
SUBMIT_WORKLOG_TOOL = {
  "name": "submit_worklog",
  "description": "Submit the consolidated work-log entries.",
  "input_schema": {"type":"object","properties":{"entries":{"type":"array","items":{
    "type":"object","properties":{
      "description":{"type":"string"},
      "minutes":{"type":"integer"},
      "case_id":{"type":["integer","null"]},
      "case_guess":{"type":"string","description":"How the user referred to the case (for unmatched display)."},
      "person_ids":{"type":"array","items":{"type":"integer"}},
      "source_type":{"type":"string","enum":["manual","event","task","comment"]},
      "source_id":{"type":["integer","null"]},
      "raw_reference":{"type":"string"}
    },"required":["description","minutes","source_type","raw_reference"]}}},
    "required":["entries"]}
}
```
`tool_choice={"type":"tool","name":"submit_worklog"}`; read `block.input["entries"]`;
`record_usage_from_message(source="worklog_consolidator", request_type="consolidate", ...)`.
**Does not persist** — returns entries to the route.

**System prompt** must encode the philosophy, the surfaced-item handling, the two-pass
logic, AI task-duration estimation, and the day budget:
```
You convert a lawyer's day into discrete work-log entries.

INPUTS:
- Selected items already on record (events, completed tasks, case comments), each with a
  case, a description, and sometimes an anchored duration. A comment represents work that
  took time (a call, a review, a follow-up) — treat it as a real activity.
- A free-text memo of everything else.
- Candidate cases and contacts to match against.

STEP 1 — SPLIT the memo into separate activities (one activity = one case). Merge each
selected item in as its own activity, carrying its source_type/source_id and case.

STEP 2 — ESTIMATE DURATIONS:
- Events with a real start/end time keep that length (anchored).
- A comment/call with no stated length ≈ 30 min (longer if the text implies more).
- TASKS: estimate from the task description and typical legal effort (a quick filing vs.
  drafting a brief). Use judgment; do NOT use one rigid number.
- Free-text work: estimate from cues ("spent the morning" = a substantial block).

STEP 3 — FIT THE DAY: The total across ALL entries must read like a realistic working day,
roughly 5–7 hours, and MUST NOT exceed 7 hours (420 minutes). Anchored items keep their
lengths; flexible work (tasks, "the morning") absorbs the remainder and is scaled to fit.
If anchored items alone exceed 7h, keep them accurate and let the total exceed — the user
will adjust. Never pad with invented activities; only distribute time across what's given.

STEP 4 — MATCH each activity to a case (fuzzy by name) and to people from the candidate
lists. If no confident case match: case_id=null, put the user's phrasing in case_guess.
Set source_type='manual', source_id=null for free-text-only entries. ALWAYS fill raw_reference.

Use the submit_worklog tool; entries in chronological order.
```

### 6.5 `schemas/inputs.py` / `schemas/outputs.py`
**Inputs:**
```python
class WorklogSelectionInput(BaseModel):
    source_type: Literal["event","task","comment"]
    source_id: int

class ConsolidateWorklogInput(BaseModel):
    transcript: str = ""
    log_date: Optional[str] = None          # YYYY-MM-DD; defaults today
    selections: list[WorklogSelectionInput] = []

class WorklogEntryInput(BaseModel):
    case_id: Optional[int] = None
    minutes: int
    description: str
    raw_reference: Optional[str] = None
    source_type: Optional[str] = "manual"
    source_id: Optional[int] = None
    person_ids: list[int] = []

class ConfirmWorklogInput(BaseModel):           # used by confirm + "save draft"
    voice_log_id: Optional[int] = None
    transcript: str = ""
    log_date: Optional[str] = None
    entries: list[WorklogEntryInput]
```
**Outputs:** `WorklogCandidateOut`, `WorklogEntryOut` (id, case_id, case_name, short_name,
minutes, description, raw_reference, activity_date, source_type, source_id, created_at,
`people: list[{id,name}]`), `ParsedWorklogEntryOut` (adds `case_guess`),
`WorklogDraftOut` (voice_log + entries). `from_attributes=True`; no `__all__` needed.

### 6.6 `routes/worklog.py` → `register_worklog_routes(mcp)` (mirror `routes/notes.py`)
All `auth.require_auth`; DB via `asyncio.to_thread`; `created_by` from `auth.get_current_user`.

| Method | Path | Phase | Purpose |
|---|---|---|---|
| GET | `/api/v1/worklog/candidates?date=YYYY-MM-DD` | 1 | Surfaced items for the date (events/tasks/comments), scoped to the user. |
| POST | `/api/v1/worklog/consolidate` | 2 | Body `ConsolidateWorklogInput`. Resolves selections, runs the consolidator, **saves a draft**, returns `WorklogDraftOut`. |
| GET | `/api/v1/worklog/drafts` | 3 | List pending drafts ("needs review"). |
| GET | `/api/v1/worklog/{voice_log_id}` | 3 | Fetch one draft for deferred confirmation. |
| POST | `/api/v1/worklog/{voice_log_id}/confirm` | 3 | Body `ConfirmWorklogInput`. Apply edits, set `confirmed`. |
| DELETE | `/api/v1/worklog/{voice_log_id}` | 3 | Discard an abandoned draft. |
| GET | `/api/v1/worklog/by-case/{case_id}` | view | Confirmed entries + total for a case. |
| GET | `/api/v1/worklog/by-person/{person_id}` | view | Confirmed entries for a contact. |
| PATCH/DELETE | `/api/v1/worklog/entries/{entry_id}` | view | Post-hoc edit/delete (optional v1.1). |

Register in `routes/__init__.py` **before** the static block; add to `__all__`.

### 6.7 MCP tool (secondary — include if time allows)
Add `log_work` to `tools.py`: accept already-structured entries (Claude resolves
cases/people via the existing `search` tool, like `import_case` does) → `db.create_worklog_draft`
(or directly confirmed). Add `LogWorkInput` to `schemas/inputs.py`. **Document it in
`MCP_INSTRUCTIONS`** (hand-maintained).

### 6.8 Dockerfile
**No change needed** — all files land in already-copied dirs (`db/`, `routes/`,
`services/`, `schemas/`).

---

## 7. Frontend Implementation

Order: **types → service → components → page → wire-in.**

### 7.1 Types — `frontend/src/types/worklog.ts`
`WorklogCandidate` (source_type, source_id, case_id, case_name, description,
anchored_minutes, when), `WorklogEntry`, `ParsedWorklogEntry` (+ case_guess),
`WorklogDraft` (voice_log fields + entries[]).

### 7.2 Service — `frontend/src/services/worklog.ts` (mirror `services/cases.ts`)
`getWorklogCandidates(date)`, `consolidateWorklog(payload)`, `listWorklogDrafts()`,
`getWorklogDraft(id)`, `confirmWorklog(id, payload)`, `discardWorklogDraft(id)`,
`getWorklogByCase(caseId)`, `getWorklogByPerson(personId)`.

### 7.3 Page — `frontend/src/pages/worklog/index.tsx` (+ `components/`)
Three-phase stepper:
1. **Input** (`worklog-input.tsx`): date picker (defaults today) → `getWorklogCandidates`
   → render grouped multi-select (Events / Completed Tasks / Comments), each row showing
   case + description + suggested time, checkbox to include. Plus a `<Textarea>` for
   free-form. "Consolidate" button.
2. **Consolidate:** `useMutation(consolidateWorklog)` with selections + transcript →
   returns a draft → advance to review. Loading state.
3. **Confirm** (`worklog-review.tsx`): editable list — description, `minutes` input (or
   quick chips), searchable **case combobox** (warning chip when `case_id` null, shows
   `case_guess`), **people multi-select**. **Running day total** at top with a subtle
   over-7h warning. Buttons: **Confirm** (`confirmWorklog`) and **Save for later** (keeps
   it a draft). Don't gate saving on required fields.

Also surface a **"Drafts to review"** entry (badge/list via `listWorklogDrafts`) so a
deferred draft can be reopened into the review step.

shadcn: `Command`/Combobox, `Checkbox`, `Input`, `Badge`, `Textarea`, `Button`, `Tabs` or a
stepper. **Square corners, Hugeicons, semantic tokens, `@/` imports.** Verify component
APIs via the shadcn MCP.

### 7.4 Case detail card — `frontend/src/pages/cases/components/case-work-log.tsx`
`useQuery(["worklog-by-case", caseId], () => getWorklogByCase(caseId))`; group by
`activity_date` (use `lib/datetime.ts`); show description, minutes, people chips,
source-type icon, and a **case time total** in the header. Mount in `detail.tsx` near
`<CaseActivityFeed/>`. Recommend **always-on** (not `feature_toggles`-gated).

### 7.5 Contact "Interactions" section — in `contact-detail-dialog.tsx`
`useQuery(["worklog-by-person", personId], ...)`; list activities naming this person, by
date, each linking to its case. Place near the SMS / roles sections.

### 7.6 Wire-in (locate first)
- **Router:** add `/log` → `pages/worklog/index.tsx` (React Router v7 route table).
- **Header/nav:** global "Log my day" button (Hugeicons mic/pencil) in
  `components/layout/` → navigates to `/log`. Consider a small badge when drafts await review.

---

## 8. Build Sequence

1. `models.py` (+ `Case` relationship).
2. `alembic revision --autogenerate -m "add worklog tables"` → review → `alembic upgrade head`.
3. `schemas/inputs.py` + `schemas/outputs.py`.
4. `db/worklog.py` → candidates, draft create, confirm, by-case/person; export in `db/__init__.py`.
5. `services/worklog_consolidator.py`.
6. `routes/worklog.py` → register in `routes/__init__.py` (before static).
7. (Optional) `tools.py` `log_work` + `MCP_INSTRUCTIONS`.
8. Restart with `/dev`; smoke-test with `curl`: candidates → consolidate (draft) → confirm
   → by-case → by-person; verify drafts list + deferred confirm.
9. Frontend: types → service → input + review components → page (stepper + drafts) → case
   card → contact section → router + header.
10. `cd frontend && npm run type-check && npm run build`; visual pass via `/dev`.

---

## 9. Verification Checklist

**Backend**
- [ ] `alembic upgrade head` clean; `alembic check` in sync.
- [ ] `GET /worklog/candidates?date=…` returns the right events/tasks/comments for the date
      (non-`is_system` comments only), scoped to the user, with anchored durations on timed events.
- [ ] `POST /worklog/consolidate` saves a **draft** and returns entries; total is ~5–7h and
      **never > 7h** (unless anchored items alone exceed it); tasks get sensible AI estimates;
      surfaced items carry `source_type`/`source_id`; unmatched case → `case_id null` + `case_guess`.
- [ ] Drafts list + `GET /worklog/{id}` support **deferred** confirmation.
- [ ] `POST /worklog/{id}/confirm` flips status to `confirmed`, applies edits.
- [ ] `by-case` / `by-person` return **confirmed-only** data with correct totals.
- [ ] Token usage row written (`source='worklog_consolidator'`). Unauthed → 401.

**Frontend**
- [ ] `npm run type-check` + `npm run build` pass.
- [ ] Phase 1: candidates render as multi-select + free-text works.
- [ ] Phase 2 → Phase 3: editable review with running total + over-7h warning.
- [ ] "Save for later" persists a draft; reopening from the drafts list lands back in review.
- [ ] Case card (grouped by day, total) + contact Interactions section render.
- [ ] Square corners, Hugeicons, semantic tokens, `@/` imports.

**Behavioral**
- [ ] Selecting a deposition event + typing "drafted the Reyes brief" yields two entries; the
      day totals to a believable ≤7h.
- [ ] No clarifying questions are ever asked; durations are estimated silently.
- [ ] A selected item already logged once does not re-surface on a later visit.

---

## 10. Open Decisions for the Implementer

1. **7-hour rule: hard vs soft.** Plan treats it as a target band (5–7h) with a 7h ceiling
   the AI won't cross, **except** when anchored events legitimately exceed it (then keep
   them accurate). The user can always override durations in confirmation. Confirm this is desired.
2. **"Done today" task filter.** `completion_date == log_date` only, or also
   `updated_at::date == log_date` for partially-done/status-changed tasks? (Plan: both,
   labeled.)
3. **Comment candidates.** Surface all user-authored (non-`is_system`) `case_comments` for
   the date as work candidates (a comment generally reflects time spent). `is_system` audit
   lines are excluded. Decide whether to also include the polymorphic `comments` table, and
   whether any further filtering is wanted.
4. **Active-case scope for matching.** User's cases first (via `attorney_ids`/`paralegal_ids`),
   fall back to all when small. Keep candidate lists lean; prompt-cache if large.
5. **Draft housekeeping.** Auto-expire/clean abandoned drafts? (Plan: provide a delete; no auto-expiry v1.)
6. **MCP `log_work` tool** — ship in v1 or defer.
7. **`minutes` display** — store integer minutes; render "1h 30m" via a `lib/` formatter.
8. **Multi-user views** — show all firm entries or filter to current user? (Small firm:
   default to all, label with initials.)

---

## 11. Guardrails (from CLAUDE.md)

- **UTC in DB**, Pacific for display. `DateTime(timezone=True)`; `func.now()` /
  `datetime.now(timezone.utc)`; never bare `datetime.now()`.
- **Route order:** new routes before `register_static_routes` (SPA catch-all is last).
- **`MCP_INSTRUCTIONS`** is hand-maintained — update if you add the MCP tool.
- **`-w 1`** stays (no shared in-memory state added here).
- **Square corners**, **Hugeicons** (not Lucide), **`@/` imports**, **kebab-case files**,
  semantic color tokens. Use the **shadcn MCP** + **Context7** before writing UI.
- Never push to `main`; stay on `claude/voice-log-case-contact-Qgp6Y`.
