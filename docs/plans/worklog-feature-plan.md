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
events (depositions, hearings), tasks completed/updated that day, and case comments in
the activity feed (a comment usually reflects something that took time). So instead of
making the user re-describe those, the system **surfaces them for one-tap selection**, and
the AI **merges** that context together with the free-text into a single day's log. The
user only free-types what *isn't* already captured.

Later, the user can open a **case** and see everything they did on it, by day, with a
rough time total — and open a **contact** and see every interaction with that person.

### Design philosophy (these shape every decision)

- **This is NOT a time tracker.** No start/stop, no 10:00–11:00 precision. The goal is
  *broad strokes* — a low-effort habit that yields a rough sense of effort per case.
- **Never make the user re-describe what's already in the system.** Surface it; let them
  select it; the AI folds it in.
- **No nitpicky follow-up questions.** The AI estimates durations from context. It never
  interrogates.
- **A realistic day, capped.** The AI consolidates everything into a believable **5–7
  working-hour day** and **never exceeds ~7 hours** total. It estimates task durations
  itself rather than using rigid per-item defaults.
- **Merge, don't link.** Surfaced items are just *context* the AI smashes into the
  unified work-log format. We do **not** keep references back to the source rows — the
  consolidated entry stands on its own. (This is a deliberate simplification.)

---

## 2. The Three-Phase Flow (the core UX — resolved with the user)

The `/log` page walks through three phases. **Phase 2 runs asynchronously** and **Phase 3
can happen later** — so the user can fire off the consolidation, walk away, and come back
to review when it's ready.

### Phase 1 — Input
Two lanes that merge:
- **Surfaced items (multi-select):** a pre-built list of things already on record for the
  selected date — **events**, **completed/updated tasks**, and **case comments** (calls
  *and* any other logged work — a comment usually reflects something that took time). Each
  is pre-filled with its case and description. The user just ticks the ones that represent
  real work-time.
- **Free-form writing:** a textarea for everything not already captured.

### Phase 2 — Consolidation (AI, **asynchronous**)
On submit, the server **creates a `voice_log` with `status='processing'`, returns
immediately, and runs the AI in a background thread.** The UI shows a "working on it — come
back later" state; the user can navigate away. The background job:
1. **Splits** the memo into discrete activities (one activity = one case).
2. **Merges** the selected surfaced items into the same set of activities (smashing each
   item's case + description into the unified format).
3. **Estimates durations** — including estimating **task** durations from their
   descriptions (not fixed defaults). Events with a real start/end time keep their length.
4. **Apportions a realistic working day** — total lands in **~5–7 hours** and **never
   exceeds 7 hours (420 min)**.
5. **Matches** each activity to a case and to people; unmatched → `case_id=null` with the
   raw phrasing preserved.
6. Writes the entries and flips the log to **`status='ready'`** (or `'failed'` on error).

This mirrors the existing intake AI pattern (see §4) and works under `-w 1` because it's
in-process.

### Phase 3 — Confirmation (now or later)
A **one-glance, editable** review of a `ready` log: the user confirms/fixes case links,
people, and durations, then confirms. On confirm, status flips to **`confirmed`**.
**Processing/ready logs live in a "needs review" list** so the user can come back anytime.
Only **confirmed** entries count toward case/contact totals.

---

## 3. Design Decisions (resolved — do not re-litigate)

| Decision | Resolution |
|---|---|
| Fan-out | **One memo → many activities.** A single dump splits into N entries. |
| Activity ↔ case | **Each activity belongs to exactly one case** (or none → unmatched). |
| Time granularity | **Per-activity** `minutes`. Each entry has its own duration. |
| Activity ↔ people | **Many-to-many.** One activity can name several people. |
| Unknown names | **Preserve raw text, leave unlinked** (`case_id=null`, keep `raw_reference`/`case_guess`). |
| Surfaced items | **Multi-select** from events, completed/updated tasks, and case comments for the date. Don't make the user re-describe them. |
| **Merge, don't link** | Surfaced items are **context only**. The AI smashes them into the unified work-log format. **No `source_type`/`source_id` back-references** — keeps the model and UI simple. |
| Time estimation | **AI estimates** (incl. task durations). Two-pass: split/merge → estimate/apportion → match. |
| Day budget | **Target ~5–7 hrs; hard ceiling ~7 hrs.** Anchored items (events with real times) keep their length; flexible work absorbs the remainder. |
| **Async consolidation** | **Phase 2 runs in a background thread.** Create the log as `processing`, return immediately, show "working on it," flip to `ready` when done. Mirror the intake AI pattern. |
| Review | **One-glance, editable, non-blocking.** Unmatched entries still save fine. |
| Deferred confirm | **The log persists** through `processing → ready → confirmed`; confirmation can happen later. Only `confirmed` entries count. |
| Audio | **Do NOT store audio.** Text only (phone dictation / paste). |
| Entry point | **Dedicated `/log` page + a global button in the app header.** |
| Naming | Domain = **`worklog`**. **Do NOT use `activity`** — already taken (see §4). |

---

## 4. Critical Codebase Facts (verified — saves rediscovery)

### Naming collision to avoid
`routes/activity.py` + `db/activity.py` + `register_activity_routes` already implement
**page-view analytics**. The frontend `CaseActivityFeed` is a **comment/system-event
feed** backed by `case_comments`. **Keep the new feature in a `worklog` namespace.**

### Async AI pattern to mirror (verified — this is exactly how Phase 2 should work)
- **Trigger:** `routes/intakes.py` ~282 —
  `threading.Thread(target=run_background_analysis, args=(intake_id,), daemon=True).start()`
  after the route has created/updated the row, then returns its JSON response immediately.
- **Worker:** `services/intake_ai.py:run_background_analysis(intake_id)` — calls
  `db.set_ai_analyzing(intake_id, True)`, broadcasts, does the LLM work with its own
  `SessionLocal()`, then `db.save_ai_analysis(...)` which writes results **and clears the
  flag** (`ai_analyzing=False`). Wrapped so the flag is always cleared on error.
- **Flag/state:** `db/intakes.py:set_ai_analyzing()` / `save_ai_analysis()` (`models.py`
  `Intake.ai_analyzing` boolean).
- **Push/poll:** the app has SSE — `broadcast({...})` (`routes/sse.py` /
  `register_sse_routes`) pushes entity-changed events the frontend listens to; polling the
  status also works.
- **`-w 1` implication:** in-process threads are fine. A server restart mid-job would
  leave `status='processing'` stuck (same limitation intakes have) — acceptable for v1; a
  `'failed'` state + manual re-run covers the error path.

### Where the "surfaced item" sources live (verified)
- **Events:** `events` table (`models.py` ~496). Filter `date == log_date`. `event_type`,
  `time`, `end_date`, `description`, `case_id`. DB module: `db/events.py`.
- **Tasks:** `tasks` table (`models.py` ~802). "Done today" = `completion_date == log_date`;
  also consider `updated_at::date == log_date` with a terminal status. DB module: `db/tasks.py`.
- **Case comments:** the activity feed is `case_comments` (`db/case_comments.py`); a
  polymorphic `comments` table also exists (`db/comments.py`, `entity_type`/`entity_id`).
  **Surface user-authored (NON-`is_system`) `case_comments` created on `log_date`** — each
  is a candidate work item. `is_system` rows are auto-generated audit lines ("X added a
  note") and must be excluded. (Structured *interactions* exist only for **intakes** —
  `intake_comments` with `detail={type:'interaction',...}`, `services/interaction_summarizer.py`
  — not cases, so the generic non-system comment is the right hook.) **Confirm at impl time.**

### Current Alembic head
- **Head: `d2cd156b344a`** (`alembic/versions/d2cd156b344a_add_alert_dismissals_table.py`).
  Single head, verified. Prefer `alembic revision --autogenerate`; re-verify with `alembic heads`.

### Patterns to mirror (exact reference files)
- **Migration:** `alembic/versions/d2cd156b344a_add_alert_dismissals_table.py`
- **DB module:** `db/notes.py` — `SessionLocal()` ctx mgr, `_x_to_dict()` via the Out schema,
  `flush()/refresh()/commit()`. Exports in `db/__init__.py` (import block ~168 + `__all__` ~524).
- **Routes:** `routes/notes.py` — `@mcp.custom_route(...)`, `auth.require_auth(request)`,
  `auth.get_current_user(request)`, `asyncio.to_thread(db.fn, ...)`, `pydantic_error(e)` /
  `api_error(...)` from `.common`. Register in `routes/__init__.py` **before**
  `register_static_routes(mcp)` (line 152); add to `__all__` (~156).
- **Input schemas:** `schemas/inputs.py` (no `__all__`; re-exported by `import *`).
  **Output schemas:** `schemas/outputs.py` — `ConfigDict(from_attributes=True)`;
  `model_dump(mode="json")` ISO-formats datetimes. `NoteOut` (97–110), `PersonOut` (357–369).
- **LLM extraction:** `services/case_extractor.py` — sync `anthropic.Anthropic`,
  `tool_choice={"type":"tool","name":...}` to FORCE structured output, read `block.input`,
  `db.token_usage.record_usage_from_message(source=..., request_type=..., model=..., message=...)`.
  Model = `settings.extraction_model` (`config.py`); key = `os.environ["ANTHROPIC_API_KEY"]`.
  Prompt-cache large candidate lists via the `cache_control` pattern in `services/chat/client.py`.
- **MCP tool:** `tools.py` `manage_note` (~1292) — `@mcp.tool()`, helpers `validation_error()`,
  `error_response()`, `not_found_error()`. Registered in `register_tools(mcp)`.
- **MCP instructions:** `main.py` `MCP_INSTRUCTIONS` (~26–69) — hand-maintained.

### Frontend facts
- **Case detail:** `frontend/src/pages/cases/detail.tsx` renders `<CaseNotesPanel/>` and
  `<CaseActivityFeed caseId={...}/>` in a right column (~315). Mount the Work Log card here.
- **Feed pattern:** `frontend/src/pages/cases/components/case-activity-feed.tsx`.
- **Contact dialog:** `frontend/src/components/common/contact-detail-dialog.tsx` — add an
  "Interactions" section.
- **Service pattern:** `frontend/src/services/cases.ts` (`apiFetch` from `@/lib/api`).
  **Types:** `frontend/src/types/case.ts`. **Datetime:** `frontend/src/lib/datetime.ts`.
- **Polling/SSE on the frontend:** there is an existing pattern for reacting to
  `ai_analyzing`-style async work (intakes) — reuse it (poll the status, or subscribe to
  the SSE stream) for the "working on it" → "ready" transition.
- **Conventions:** `@/` imports; `kebab-case.tsx`; **square corners** (no `rounded-*`);
  semantic color tokens; **Hugeicons** (not Lucide); TanStack Query; React Hook Form + Zod;
  shadcn via `npx shadcn@latest add` (check APIs with the shadcn MCP + Context7).
- **Locate at impl time:** the **router** (React Router v7 — likely `frontend/src/App.tsx`)
  for `/log`, and the **app header/sidebar** (`frontend/src/components/layout/`) for the
  global "Log my day" button.

---

## 5. Data Model

Three new tables. Prefer: edit `models.py`, then
`alembic revision --autogenerate -m "add worklog tables"` → review → `alembic upgrade head`.

### `voice_logs` — one row per logging session
| column | type | notes |
|---|---|---|
| `id` | Integer PK | |
| `transcript` | Text, nullable | the raw free-text (may be empty if the day was all surfaced items) |
| `log_date` | Date, not null | the date the work happened (defaults today, editable) |
| `status` | String(20), not null, default `'processing'` | `'processing'` → `'ready'` → `'confirmed'`; `'failed'` on error |
| `error` | Text, nullable | failure detail when `status='failed'` |
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
| `description` | Text, not null | concise summary (the AI's merged/smashed text) |
| `raw_reference` | Text, nullable | original phrase / case_guess (preserved, esp. unmatched) |
| `activity_date` | Date, not null | denormalized from `log_date` for per-case/day queries |
| `created_at` | DateTime(tz=True), default CURRENT_TIMESTAMP | |

> **No `source_type`/`source_id`.** Surfaced items are merged into the description by the
> AI; we don't keep references back to the source rows.

Indexes: `case_id`, `voice_log_id`, `activity_date`.

### `worklog_entry_people` — junction (entry ↔ persons, many-to-many)
| column | type | notes |
|---|---|---|
| `entry_id` | Integer FK→`worklog_entries.id` CASCADE | composite PK |
| `person_id` | Integer FK→`persons.id` CASCADE | composite PK |

Index: `person_id`.

**SQLAlchemy notes:** follow `models.py` conventions — `Mapped`/`mapped_column`,
`DateTime(timezone=True)` (UTC), `server_default=text("CURRENT_TIMESTAMP")`, explicit
`ForeignKeyConstraint`+`Index` in `__table_args__`, `relationship(..., passive_deletes=True)`.
Add a `Case.worklog_entries` relationship. Use `func.now()` / `datetime.now(timezone.utc)`.

---

## 6. Backend Implementation

### 6.1 `models.py`
Add `VoiceLog`, `WorklogEntry`, `WorklogEntryPerson` (§5) + `Case.worklog_entries`.

### 6.2 Migration
`alembic revision --autogenerate -m "add worklog tables"` → review → `alembic upgrade head`.

### 6.3 `db/worklog.py` (mirror `db/notes.py`; status helpers mirror `db/intakes.py`)
```python
def get_worklog_candidates(log_date, user_id) -> dict
# {"events":[...], "tasks":[...], "comments":[...]} for log_date, scoped to the user's cases
# (case.attorney_ids/paralegal_ids contains user_id; fall back to all). Each candidate:
# {source_type, source_id, case_id, case_name, short_name, description, anchored_minutes|None, when}.
# (source_type/source_id are used ONLY to fetch context in Phase 2 — they are NOT stored on entries.)
# events: date==log_date. tasks: completion_date==log_date (and/or updated_at::date==log_date,
# terminal status). comments: user-authored NON-is_system case_comments created on log_date.

def create_processing_log(transcript, log_date, created_by) -> int
# Insert a voice_log with status='processing'; return its id (route returns immediately).

def set_worklog_status(voice_log_id, status, error=None) -> None     # mirror set_ai_analyzing
def save_consolidated_entries(voice_log_id, entries) -> dict          # mirror save_ai_analysis:
# delete any existing entries for this log, insert the new entries + people junction,
# set status='ready'. entries: [{case_id|None, minutes, description, raw_reference, person_ids}]

def get_worklog(voice_log_id) -> dict | None      # voice_log + entries (for polling + review)
def list_pending_worklogs(user_id) -> list        # status in ('processing','ready') — "needs review"
def confirm_worklog(voice_log_id, transcript, log_date, entries) -> dict
# Apply the user's edits, set status='confirmed', confirmed_at=now.
def get_worklog_by_case(case_id) -> dict          # CONFIRMED only; entries + total, grouped by date
def get_worklog_by_person(person_id) -> dict      # CONFIRMED only; entries + case info
def delete_worklog(voice_log_id) -> bool          # discard
def update_worklog_entry(entry_id, **fields) -> dict|None   # post-hoc edit (optional)
def delete_worklog_entry(entry_id) -> bool                  # optional
```
`get_worklog_by_case`/`by_person` must filter `voice_logs.status == 'confirmed'`. Eager-load
people + case names to avoid N+1. Export all in `db/__init__.py`.

### 6.4 `services/worklog_consolidator.py` (LLM = `case_extractor`; async = `intake_ai`)
**`run_worklog_consolidation(voice_log_id, transcript, log_date, selections, user_id)`** — the
background-thread entry point (mirrors `services/intake_ai.py:run_background_analysis`):
```python
def run_worklog_consolidation(voice_log_id, transcript, log_date, selections, user_id):
    try:
        # 1. Resolve `selections` (list of {source_type, source_id}) to their text/case/duration
        #    via db.get_worklog_candidates or targeted lookups.
        # 2. Gather candidate cases + contacts (id+name) for matching (prompt-cache if large).
        # 3. Call Claude (forced submit_worklog tool) -> entries.
        # 4. db.save_consolidated_entries(voice_log_id, entries)  # sets status='ready'
        # 5. broadcast({"entity":"worklog","action":"ready","id":voice_log_id, ...})
    except Exception as e:
        db.set_worklog_status(voice_log_id, "failed", error=str(e))
        # broadcast failure too
```
Forced tool (no source fields — merge, don't link):
```python
SUBMIT_WORKLOG_TOOL = {
  "name": "submit_worklog",
  "description": "Submit the consolidated work-log entries for the day.",
  "input_schema": {"type":"object","properties":{"entries":{"type":"array","items":{
    "type":"object","properties":{
      "description":{"type":"string"},
      "minutes":{"type":"integer"},
      "case_id":{"type":["integer","null"]},
      "case_guess":{"type":"string","description":"How the user referred to the case (for unmatched display)."},
      "person_ids":{"type":"array","items":{"type":"integer"}},
      "raw_reference":{"type":"string"}
    },"required":["description","minutes","raw_reference"]}}},
    "required":["entries"]}
}
```
`tool_choice={"type":"tool","name":"submit_worklog"}`; read `block.input["entries"]`;
`record_usage_from_message(source="worklog_consolidator", request_type="consolidate", ...)`.

**System prompt** (philosophy + merge + two-pass + AI task estimation + day budget):
```
You convert a lawyer's day into discrete work-log entries.

INPUTS:
- Selected items already on record (events, completed tasks, case comments), each with a
  case, a description, and sometimes an anchored duration. MERGE these in as activities —
  smash each item's context into the unified entry format. A comment represents work that
  took time (a call, a review, a follow-up).
- A free-text memo of everything else.
- Candidate cases and contacts to match against.

STEP 1 — SPLIT & MERGE: Break the memo into separate activities (one activity = one case),
and fold each selected item in as its own activity. Combine details where they describe the
same piece of work.

STEP 2 — ESTIMATE DURATIONS:
- Events with a real start/end time keep that length (anchored).
- A comment/call with no stated length ≈ 30 min (longer if the text implies more).
- TASKS: estimate from the description and typical legal effort (quick filing vs. drafting a
  brief). Use judgment; do NOT use one rigid number.
- Free-text work: estimate from cues ("spent the morning" = a substantial block).

STEP 3 — FIT THE DAY: The total across ALL entries must read like a realistic working day,
roughly 5–7 hours, and MUST NOT exceed 7 hours (420 minutes). Anchored items keep their
lengths; flexible work absorbs the remainder and is scaled to fit. If anchored items alone
exceed 7h, keep them accurate and let the total exceed — the user will adjust. Never pad with
invented activities; only distribute time across what's given.

STEP 4 — MATCH each activity to a case (fuzzy by name) and to people from the candidate lists.
No confident case match -> case_id=null, put the user's phrasing in case_guess. ALWAYS fill
raw_reference. Use the submit_worklog tool; entries in chronological order.
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
    person_ids: list[int] = []

class ConfirmWorklogInput(BaseModel):
    transcript: str = ""
    log_date: Optional[str] = None
    entries: list[WorklogEntryInput]
```
**Outputs:** `WorklogCandidateOut`, `WorklogEntryOut` (id, case_id, case_name, short_name,
minutes, description, raw_reference, activity_date, created_at, `people: list[{id,name}]`,
plus `case_guess` for the review step), `WorklogOut` (voice_log fields incl. `status`/`error`
+ `entries`). `from_attributes=True`; no `__all__` needed.

### 6.6 `routes/worklog.py` → `register_worklog_routes(mcp)` (mirror `routes/notes.py` + `routes/intakes.py`)
All `auth.require_auth`; DB via `asyncio.to_thread`; `created_by` from `auth.get_current_user`.

| Method | Path | Phase | Purpose |
|---|---|---|---|
| GET | `/api/v1/worklog/candidates?date=YYYY-MM-DD` | 1 | Surfaced items (events/tasks/comments), scoped to the user. |
| POST | `/api/v1/worklog/consolidate` | 2 | Body `ConsolidateWorklogInput`. **`db.create_processing_log(...)` → spawn `threading.Thread(target=run_worklog_consolidation, args=(id, transcript, log_date, selections, user_id), daemon=True).start()` → return `{voice_log_id, status:"processing"}` immediately.** |
| GET | `/api/v1/worklog/{voice_log_id}` | 2/3 | Poll status + fetch entries (for "working on it" → review). |
| GET | `/api/v1/worklog/pending` | 3 | Logs in `processing`/`ready` — the "needs review" list. |
| POST | `/api/v1/worklog/{voice_log_id}/confirm` | 3 | Body `ConfirmWorklogInput`. Apply edits → `confirmed`. |
| DELETE | `/api/v1/worklog/{voice_log_id}` | 3 | Discard. |
| GET | `/api/v1/worklog/by-case/{case_id}` | view | Confirmed entries + total. |
| GET | `/api/v1/worklog/by-person/{person_id}` | view | Confirmed entries for a contact. |
| PATCH/DELETE | `/api/v1/worklog/entries/{entry_id}` | view | Post-hoc edit/delete (optional v1.1). |

Register in `routes/__init__.py` **before** the static block; add to `__all__`. Optionally
`broadcast(...)` on status changes for live UI (mirror intakes).

### 6.7 MCP tool (secondary — include if time allows)
`log_work` in `tools.py`: accept already-structured entries (Claude resolves cases/people
via the existing `search` tool) → save directly as a `confirmed` log. Add `LogWorkInput` to
`schemas/inputs.py`; **document in `MCP_INSTRUCTIONS`**.

### 6.8 Dockerfile
**No change needed** — all files land in already-copied dirs.

---

## 7. Frontend Implementation

Order: **types → service → components → page → wire-in.**

### 7.1 Types — `frontend/src/types/worklog.ts`
`WorklogCandidate`, `WorklogEntry` (+ `case_guess`), `Worklog` (voice_log fields incl.
`status`/`error` + `entries[]`).

### 7.2 Service — `frontend/src/services/worklog.ts` (mirror `services/cases.ts`)
`getWorklogCandidates(date)`, `consolidateWorklog(payload)` (returns `{voice_log_id, status}`),
`getWorklog(id)` (poll), `listPendingWorklogs()`, `confirmWorklog(id, payload)`,
`discardWorklog(id)`, `getWorklogByCase(caseId)`, `getWorklogByPerson(personId)`.

### 7.3 Page — `frontend/src/pages/worklog/index.tsx` (+ `components/`)
Stepper:
1. **Input** (`worklog-input.tsx`): date picker (defaults today) → `getWorklogCandidates`
   → grouped multi-select (Events / Completed Tasks / Comments), each row showing case +
   description + suggested time + checkbox. Plus a `<Textarea>` for free-form. "Consolidate".
2. **Processing** (async): on `consolidateWorklog`, get back `{voice_log_id, status:'processing'}`.
   Show a "working on it — you can come back later" state and **poll `getWorklog(id)`** (or
   subscribe to SSE) until `status==='ready'` (or `'failed'`). The user may leave the page;
   the log stays in the **pending** list.
3. **Confirm** (`worklog-review.tsx`): once `ready`, editable list — description, `minutes`
   input (or quick chips), searchable **case combobox** (warning chip + `case_guess` when
   null), **people multi-select**, **running day total** with an over-7h warning. **Confirm**
   (`confirmWorklog`) or leave it pending. Don't gate saving on required fields.

Also surface a **"To review"** entry (badge/list via `listPendingWorklogs`) so a processing
or ready log can be reopened — supporting "come back later."

shadcn: `Command`/Combobox, `Checkbox`, `Input`, `Badge`, `Textarea`, `Button`, stepper/`Tabs`.
**Square corners, Hugeicons, semantic tokens, `@/` imports.** Verify APIs via the shadcn MCP.

### 7.4 Case detail card — `frontend/src/pages/cases/components/case-work-log.tsx`
`useQuery(["worklog-by-case", caseId], () => getWorklogByCase(caseId))`; group by
`activity_date` (`lib/datetime.ts`); show description, minutes, people chips, and a **case
time total**. Mount in `detail.tsx` near `<CaseActivityFeed/>`. **Always-on** (not toggle-gated).

### 7.5 Contact "Interactions" section — in `contact-detail-dialog.tsx`
`useQuery(["worklog-by-person", personId], ...)`; list activities naming this person, by
date, each linking to its case. Place near the SMS / roles sections.

### 7.6 Wire-in (locate first)
- **Router:** add `/log` → `pages/worklog/index.tsx`.
- **Header/nav:** global "Log my day" button (Hugeicons mic/pencil) in `components/layout/`;
  consider a badge when items await review (`listPendingWorklogs`).

---

## 8. Build Sequence

1. `models.py` (+ `Case` relationship).
2. `alembic revision --autogenerate -m "add worklog tables"` → review → `alembic upgrade head`.
3. `schemas/inputs.py` + `schemas/outputs.py`.
4. `db/worklog.py` → candidates, `create_processing_log`, `set_worklog_status`,
   `save_consolidated_entries`, `confirm_worklog`, by-case/person; export in `db/__init__.py`.
5. `services/worklog_consolidator.py` → `run_worklog_consolidation` (background) + the LLM call.
6. `routes/worklog.py` → consolidate spawns the thread + returns immediately; register before static.
7. (Optional) `tools.py` `log_work` + `MCP_INSTRUCTIONS`.
8. Restart with `/dev`; smoke-test with `curl`: candidates → consolidate (returns processing)
   → poll `GET /worklog/{id}` until `ready` → confirm → by-case/person; check the pending list.
9. Frontend: types → service → input + processing + review components → page → case card →
   contact section → router + header.
10. `cd frontend && npm run type-check && npm run build`; visual pass via `/dev`.

---

## 9. Verification Checklist

**Backend**
- [ ] `alembic upgrade head` clean; `alembic check` in sync.
- [ ] `GET /worklog/candidates?date=…` returns the right events/tasks/comments (non-`is_system`
      comments only), scoped to the user, with anchored durations on timed events.
- [ ] `POST /worklog/consolidate` **returns immediately** with `status:'processing'`; the
      background thread populates entries and flips to `ready`; errors flip to `failed` with
      an `error` message (and never leave the flag stuck except on hard restart).
- [ ] Consolidated total is ~5–7h and **never > 7h** (unless anchored items alone exceed it);
      tasks get sensible AI estimates; surfaced items are merged into descriptions; unmatched
      case → `case_id null` + `case_guess`.
- [ ] `GET /worklog/{id}` supports polling; `GET /worklog/pending` lists processing+ready.
- [ ] `POST /worklog/{id}/confirm` flips to `confirmed`, applies edits.
- [ ] `by-case`/`by-person` return **confirmed-only** data with correct totals.
- [ ] Token usage row written (`source='worklog_consolidator'`). Unauthed → 401.

**Frontend**
- [ ] `npm run type-check` + `npm run build` pass.
- [ ] Phase 1: candidates render as multi-select + free-text works.
- [ ] Phase 2: shows "working on it," lets the user leave, and the log appears in "To review";
      the page reacts when it becomes `ready` (poll/SSE).
- [ ] Phase 3: editable review with running total + over-7h warning; confirm persists.
- [ ] Case card (grouped by day, total) + contact Interactions section render.
- [ ] Square corners, Hugeicons, semantic tokens, `@/` imports.

**Behavioral**
- [ ] Selecting a deposition event + a couple of case comments + typing "drafted the Reyes
      brief" yields merged entries totaling a believable ≤7h.
- [ ] No clarifying questions are ever asked; durations are estimated silently.
- [ ] Firing consolidation and navigating away, then returning later, lands in review.

---

## 10. Open Decisions for the Implementer

1. **7-hour rule: hard vs soft.** Target band (5–7h), 7h ceiling the AI won't cross **except**
   when anchored events legitimately exceed it. User overrides in confirmation. Confirm desired.
2. **"Done today" task filter.** `completion_date == log_date` only, or also
   `updated_at::date == log_date` for status-changed tasks? (Plan: both, labeled.)
3. **Comment candidates.** Surface all user-authored (non-`is_system`) `case_comments` for the
   date. Decide whether to also include the polymorphic `comments` table and any extra filtering.
4. **Active-case scope for matching.** User's cases first (`attorney_ids`/`paralegal_ids`),
   fall back to all when small. Keep candidate lists lean; prompt-cache if large.
5. **Re-surfacing.** Without source-linking, the same comment/event can appear as a candidate
   again if the user re-opens `/log` for the same date. Low-risk (a day is logged once; the
   user reviews before confirming). Decide whether to bother dedup'ing; v1 can ignore it.
6. **Stuck `processing` on restart.** In-process thread dies if the server restarts mid-job
   (same as intakes). Acceptable for v1; consider a "re-run" affordance on a stale log.
7. **MCP `log_work` tool** — ship in v1 or defer.
8. **`minutes` display** — store integer minutes; render "1h 30m" via a `lib/` formatter.
9. **Multi-user views** — show all firm entries or filter to current user? (Small firm:
   default to all, label with initials.)

---

## 11. Guardrails (from CLAUDE.md)

- **UTC in DB**, Pacific for display. `DateTime(timezone=True)`; `func.now()` /
  `datetime.now(timezone.utc)`; never bare `datetime.now()`.
- **Route order:** new routes before `register_static_routes` (SPA catch-all is last).
- **`MCP_INSTRUCTIONS`** is hand-maintained — update if you add the MCP tool.
- **`-w 1`** stays. The async consolidation uses an **in-process daemon thread** (like
  intakes) — no extra workers, no external queue.
- **Square corners**, **Hugeicons** (not Lucide), **`@/` imports**, **kebab-case files**,
  semantic color tokens. Use the **shadcn MCP** + **Context7** before writing UI.
- Never push to `main`; stay on `claude/voice-log-case-contact-Qgp6Y`.
