# Implementation Plan — Work Log (Voice-Driven Activity Logging)

> **Status:** Ready to implement. This plan was developed against the current
> codebase (branch `claude/voice-log-case-contact-Qgp6Y`) with all file paths,
> patterns, and the current Alembic head verified. Hand this to a local Claude
> session that has the database, Python deps, and dev servers available.

---

## 1. The Feature (what we're building and why)

The user (an attorney) wants to record a short, **stream-of-consciousness voice/text
memo once or twice a day** describing what they worked on — e.g. *"I spent the
morning on the opposition to the motion to dismiss in the Armstrong case, then had
a call with Tanner Navaroli about the Reyes matter, then drafted discovery for
Armstrong again."*

The system turns that unstructured dump into discrete, time-estimated **work log
entries**, each linked to a case (and optionally to people), so that later the user
can:

- Open a **case** and see everything they did on it, by day, with a rough time total.
- Open a **contact** and see every time they interacted with that person.

### Design philosophy (important — these shape every decision)

- **This is NOT a time tracker.** No start/stop, no 10:00–11:00 precision. The goal
  is *broad strokes* — a habit of recording work so the user gets a rough sense of
  effort per case over time.
- **No nitpicky follow-up questions.** If the user doesn't say how long something
  took, the system **estimates** using sensible defaults. It never interrogates.
- **Estimates from context.** "Had a call" → default ~30 min. "Spent the morning on
  X" with nothing else competing for the morning → ~3.5–4 hrs. The model reasons
  about the *whole day as a budget*.

---

## 2. Design Decisions (already resolved with the user — do not re-litigate)

| Decision | Resolution |
|---|---|
| Fan-out | **One memo → many activities.** A single dump splits into N entries. |
| Activity ↔ case | **Each activity belongs to exactly one case** (or none → unmatched). |
| Time granularity | **Per-activity** `minutes` estimate. Each entry gets its own duration. |
| Activity ↔ people | **Many-to-many.** One activity (e.g. a meeting) can name several people. |
| Unknown names | **Preserve raw text, leave unlinked.** Never drop the original phrase. If a case/person isn't found, save the entry with `case_id = NULL` and keep `raw_reference`. |
| Review step | **One-glance, editable, non-blocking.** After parsing, show the parsed entries as an editable list; user can fix a mislinked case/person or nudge minutes, then Save. Nothing persists until confirmed. This is NOT the "nitpicky questions" the user dislikes — it's a single confirmation screen. |
| Audio | **Do NOT store audio.** Text only. For the MVP the user dictates with their phone's native dictation (or pastes) into a textarea. Transcription/audio capture is explicitly out of scope. |
| Time estimation | **Two-pass within a single LLM call:** (1) split the memo into discrete activities, (2) divide the day's time across them so "the morning" can't be double-counted. |
| Entry point | **Dedicated `/log` page + a global button in the app header.** Logging spans multiple cases, so it cannot live on a single case page. |
| Naming | Use the domain name **`worklog`** internally. **Do NOT use `activity`** — that namespace is already taken (see §3). User-facing copy can say "Work Log" / "Activities". |

---

## 3. Critical Codebase Facts (verified — saves you rediscovery)

### Naming collision to avoid
`routes/activity.py` + `db/activity.py` + `register_activity_routes` already exist and
implement **page-view analytics** (`POST /api/v1/tracking/pageview`,
`GET /api/v1/activity/summary`, etc.). The frontend `CaseActivityFeed` is a
**comment/system-event feed** backed by `case_comments`, not work logging. **Keep the
new feature in a separate `worklog` namespace** to avoid colliding with both.

### Current Alembic head
- **Head revision: `d2cd156b344a`** (file
  `alembic/versions/d2cd156b344a_add_alert_dismissals_table.py`). Single head, verified.
- Your new migration's `down_revision` must be `'d2cd156b344a'` — **unless** you use
  `alembic revision --autogenerate` (preferred, since you have a live DB), which sets
  it automatically. Re-verify the head at implementation time with `alembic heads`.

### Patterns to mirror (exact reference files)
- **Migration format:** `alembic/versions/d2cd156b344a_add_alert_dismissals_table.py`
- **DB module:** `db/notes.py` — `SessionLocal()` context manager, `_x_to_dict()`
  helper using the Pydantic Out schema, `flush()/refresh()/commit()` ordering.
- **DB exports:** `db/__init__.py` — import block (~line 168 for notes) + `__all__`
  list (~line 524). Add your new functions to both.
- **Routes:** `routes/notes.py` — `@mcp.custom_route(...)`, `auth.require_auth(request)`,
  `asyncio.to_thread(db.fn, ...)`, `pydantic_error(e)` / `api_error(...)` from `.common`.
- **Route registration:** `routes/__init__.py` — import (~lines 35–66), call
  `register_worklog_routes(mcp)` **before** `register_static_routes(mcp)` (currently
  line 152), and add to `__all__` (~line 156). **Static must stay last** (SPA catch-all).
- **Input schemas:** `schemas/inputs.py` — plain `BaseModel`s, no `__all__` (picked up by
  `from .inputs import *` in `schemas/__init__.py`). Note pattern at lines 113–119.
- **Output schemas:** `schemas/outputs.py` — `model_config = ConfigDict(from_attributes=True)`;
  `model_dump(mode="json")` auto-ISO-formats datetimes. `NoteOut` at lines 97–110,
  `PersonOut` at 357–369 are good templates.
- **LLM extraction:** `services/case_extractor.py` — sync `anthropic.Anthropic` client,
  `tool_choice={"type": "tool", "name": "..."}` to FORCE structured output, read
  `block.input` from the `tool_use` block, and
  `db.token_usage.record_usage_from_message(source=..., request_type=..., model=..., message=...)`.
  Model comes from `settings.extraction_model` (`config.py`), API key from
  `os.environ["ANTHROPIC_API_KEY"]`.
- **MCP tool:** `tools.py` `manage_note` (~line 1292) — `@mcp.tool()`, helpers
  `validation_error()`, `error_response()`, `not_found_error()`; `Context` carries
  `case_context` for the currently-viewed case. Registered inside `register_tools(mcp)`.
- **MCP instructions:** `main.py` `MCP_INSTRUCTIONS` string (~lines 26–69; tools overview
  ~30–41). **Hand-maintained** — must be updated when adding an MCP tool.

### Frontend facts
- **Case detail page:** `frontend/src/pages/cases/detail.tsx` — renders
  `<CaseNotesPanel .../>` and `<CaseActivityFeed caseId={caseData.id} />` in a right
  column (~line 315). Add the new Work Log card here.
- **Activity feed component (pattern reference):**
  `frontend/src/pages/cases/components/case-activity-feed.tsx` — TanStack Query
  (`useQuery`), service call, card layout.
- **Contact detail dialog:** `frontend/src/components/common/contact-detail-dialog.tsx` —
  sections for contact info, an SMS section, and roles-by-case. Add an "Interactions"
  (work-log) section here.
- **Service pattern:** `frontend/src/services/cases.ts` — `apiFetch` from `@/lib/api`,
  `URLSearchParams`, `res.ok` checks. **Types** in `frontend/src/types/case.ts`.
- **Feature toggles:** `case.feature_toggles` (JSONB) gated via `isCaseFeatureEnabled(...)`.
  Decide whether the case Work Log card is always-on or toggle-gated (recommendation:
  **always-on**, since logging is global, not a per-case opt-in section).
- **Conventions (from CLAUDE.md):** `@/` import alias always; `kebab-case.tsx` files;
  **square corners** (no `rounded-*`); semantic color tokens (`--success`, etc.);
  **Hugeicons** (not Lucide); TanStack Query for server state; React Hook Form + Zod for
  forms; shadcn primitives via `npx shadcn@latest add`. Use the shadcn MCP to check
  component APIs before writing UI.
- **To locate at implementation time** (not verified here): the **router** (React Router
  v7 route table — likely `frontend/src/App.tsx` or a `routes`/`router` file) and the
  **app header/sidebar** (`frontend/src/components/layout/` per CLAUDE.md, e.g.
  `app-sidebar.tsx` / a header component). Add the `/log` route and the global nav button
  there.

---

## 4. Data Model

Three new tables. **Preferred workflow:** add the SQLAlchemy models to `models.py`, then
run `alembic revision --autogenerate -m "add worklog tables"`, review, and
`alembic upgrade head`. (`models.py` is the schema source of truth.)

### `voice_logs` — one row per brain-dump
| column | type | notes |
|---|---|---|
| `id` | Integer PK | |
| `transcript` | Text, not null | the raw text the user typed/dictated |
| `log_date` | Date, not null | the date the work happened (defaults to today, editable in UI) |
| `created_by` | Integer FK → `users.id` ON DELETE SET NULL, nullable | who logged it |
| `created_at` | DateTime(timezone=True), server_default CURRENT_TIMESTAMP | |

### `worklog_entries` — the split-out, time-estimated activities
| column | type | notes |
|---|---|---|
| `id` | Integer PK | |
| `voice_log_id` | Integer FK → `voice_logs.id` ON DELETE CASCADE, not null | |
| `case_id` | Integer FK → `cases.id` ON DELETE SET NULL, **nullable** | NULL = unmatched |
| `minutes` | Integer, not null | estimated duration |
| `description` | Text, not null | concise summary of the work |
| `raw_reference` | Text, nullable | the original phrase from the memo (always preserved, esp. when unmatched) |
| `activity_date` | Date, not null | denormalized from the voice_log's `log_date` for easy per-case/day queries |
| `created_at` | DateTime(timezone=True), server_default CURRENT_TIMESTAMP | |

Indexes: `case_id`, `voice_log_id`, `activity_date`.

### `worklog_entry_people` — junction (entry ↔ persons, many-to-many)
| column | type | notes |
|---|---|---|
| `entry_id` | Integer FK → `worklog_entries.id` ON DELETE CASCADE | composite PK |
| `person_id` | Integer FK → `persons.id` ON DELETE CASCADE | composite PK |

Index: `person_id` (for the "click a contact → see interactions" query).

**SQLAlchemy notes:** follow the `models.py` conventions exactly —
`Mapped[...]`/`mapped_column`, `DateTime(timezone=True)` for all timestamps (UTC),
`server_default=text("CURRENT_TIMESTAMP")`, explicit `ForeignKeyConstraint` +
`Index` in `__table_args__`, and `relationship(... passive_deletes=True)` where
parent cascades. Add a `worklog_entries` relationship to `Case` and a
back-reference on `Person` if convenient (mirror how `Note`/`PersonRole` relate to
`Case`). Use `datetime.now(timezone.utc)` / `func.now()` — never bare `datetime.now()`.

---

## 5. Backend Implementation

### 5.1 `models.py`
Add `VoiceLog`, `WorklogEntry`, `WorklogEntryPerson` per §4. Place them near the other
case-related child tables. Add relationships to `Case` (and optionally `Person`).

### 5.2 Migration
- Preferred: `alembic revision --autogenerate -m "add worklog tables"` → review the
  generated file (autogenerate misses partial indexes; this model has none, so it
  should be clean) → `alembic upgrade head`.
- The generated file should mirror
  `alembic/versions/d2cd156b344a_add_alert_dismissals_table.py`. `down_revision` will be
  set to the current head automatically.

### 5.3 `db/worklog.py`
Mirror `db/notes.py`. Functions:

```python
def create_worklog(transcript, log_date, created_by, entries) -> dict
# entries: list of {case_id|None, minutes, description, raw_reference, person_ids: [int]}
# Creates the VoiceLog + all WorklogEntry rows + people junction rows in ONE transaction.

def get_worklog_by_case(case_id) -> dict
# Returns entries for a case, newest first, grouped/orderable by activity_date,
# each with its people (id+name) and a total-minutes summary.

def get_worklog_by_person(person_id) -> dict
# Returns entries that name this person, newest first, each with its case (id+name).

def delete_worklog_entry(entry_id) -> bool
def update_worklog_entry(entry_id, **fields) -> dict | None  # edit minutes/description/case_id/people post-hoc
```

Use `SessionLocal()` context manager, `flush()/refresh()` before building the dict,
`commit()` last. Add `_entry_to_dict()` using `WorklogEntryOut`. Eager-load people and
case names with `selectinload`/joins to avoid N+1.

Export all functions in `db/__init__.py` (import block + `__all__`).

### 5.4 `services/worklog_extractor.py`
A near-twin of `services/case_extractor.py`. Responsibilities:

1. Accept the raw `transcript`, the `log_date`, and **candidate context**: a compact list
   of the firm's active cases (`id`, `case_name`, `short_name`) and contacts
   (`id`, `name`, `organization`). Pull these via existing `db` queries (e.g. a light
   case list + `db.persons` list). Keep the lists lean (id + name) to control tokens;
   prompt-cache them if they get large (see `services/chat/client.py` for the
   `cache_control` pattern).
2. Call Claude (`settings.extraction_model`) with a **single forced tool** —
   `submit_worklog` — whose input schema is a list of entries:

```python
SUBMIT_WORKLOG_TOOL = {
    "name": "submit_worklog",
    "description": "Submit the structured work-log entries extracted from the memo.",
    "input_schema": {
        "type": "object",
        "properties": {
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string", "description": "Concise summary of the work done."},
                        "minutes": {"type": "integer", "description": "Estimated duration in minutes."},
                        "case_id": {"type": ["integer", "null"], "description": "ID of the matched case, or null if no confident match."},
                        "case_guess": {"type": "string", "description": "The case name as the user referred to it (for display when unmatched)."},
                        "person_ids": {"type": "array", "items": {"type": "integer"}, "description": "IDs of matched people mentioned in this activity."},
                        "raw_reference": {"type": "string", "description": "The original phrase from the memo this entry came from."}
                    },
                    "required": ["description", "minutes", "raw_reference"]
                }
            }
        },
        "required": ["entries"]
    }
}
```

3. Use `tool_choice={"type": "tool", "name": "submit_worklog"}`, read `block.input["entries"]`.
4. `record_usage_from_message(source="worklog_extractor", request_type="parse_worklog", model=..., message=message)`.
5. Return the entries list (the route hands it to the frontend for review; it is NOT
   saved yet).

**System prompt must encode the philosophy and the two-pass logic.** Sketch:

```
You convert a lawyer's informal end-of-day memo into discrete work-log entries.

STEP 1 — SPLIT: Break the memo into separate activities. Each activity is a distinct
piece of work tied to a single case. "Drafted discovery for Armstrong, then a call
with Tanner about Reyes, then back to the Armstrong opposition" = THREE activities.

STEP 2 — ESTIMATE TIME (treat the day as a budget): Assign each activity a duration in
minutes using context. Rules of thumb:
  - A phone call / quick call with no stated length ≈ 30 minutes.
  - "Spent the morning / the afternoon on X" ≈ 210–240 minutes IF nothing else competes
    for that block; if the morning contains several activities, divide the block among
    them sensibly.
  - A short task ("sent an email", "reviewed a doc") ≈ 10–20 minutes.
  - Never inflate. If duration is truly unknowable and there's no anchor, estimate
    conservatively. Do NOT ask the user for clarification — just estimate.
  - Do not let the day's total exceed what the memo implies (don't fill the morning AND
    log a separate 3-hour morning call).

STEP 3 — MATCH: For each activity, match the case to the provided case list by name
(fuzzy is fine — "Armstrong" → the case whose name contains Armstrong). Match named
people to the contact list. If you cannot confidently match a case, set case_id=null
and put the user's phrasing in case_guess. Same for people (omit unmatched). ALWAYS
fill raw_reference with the original phrase.

Use the submit_worklog tool. Provide entries in the order they occurred.
```

> **Matching note:** The model does the matching from the supplied lists. As a
> belt-and-suspenders improvement (optional), the route can run any `case_id=null`
> entries through the existing `db.fuzzy_search_persons_db` / case search to offer a
> best-guess in the review UI. Not required for v1.

### 5.5 `schemas/inputs.py` and `schemas/outputs.py`
**Inputs:**
```python
class WorklogEntryInput(BaseModel):
    case_id: Optional[int] = None
    minutes: int
    description: str
    raw_reference: Optional[str] = None
    person_ids: list[int] = []

class ParseWorklogInput(BaseModel):
    transcript: str
    log_date: Optional[str] = None  # YYYY-MM-DD; defaults to today server-side

class SaveWorklogInput(BaseModel):
    transcript: str
    log_date: Optional[str] = None
    entries: list[WorklogEntryInput]
```
**Outputs:** `WorklogEntryOut` (`from_attributes=True`: id, case_id, minutes, description,
raw_reference, activity_date, created_at, plus nested `people: list[{id,name}]` and
optional `case_name`/`short_name`). A `ParsedWorklogEntryOut` for the parse response
(includes `case_guess`). Mirror `NoteOut`. No `__all__` needed — re-exported by `import *`.

### 5.6 `routes/worklog.py` → `register_worklog_routes(mcp)`
Mirror `routes/notes.py`. Endpoints (all `auth.require_auth`, all DB calls via
`asyncio.to_thread`):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/worklog/parse` | Body `ParseWorklogInput`. Calls the extractor, returns parsed entries (NOT saved). |
| POST | `/api/v1/worklog` | Body `SaveWorklogInput`. Persists via `db.create_worklog`. Returns the saved rows. |
| GET | `/api/v1/worklog/by-case/{case_id}` | Entries + total minutes for a case. |
| GET | `/api/v1/worklog/by-person/{person_id}` | Entries for a contact. |
| PATCH | `/api/v1/worklog/entries/{entry_id}` | Edit an entry post-hoc (optional v1.1). |
| DELETE | `/api/v1/worklog/entries/{entry_id}` | Delete an entry (optional v1.1). |

Get the current user via `auth.get_current_user(request)` for `created_by`. Register in
`routes/__init__.py` **before** the static block; add to `__all__`.

### 5.7 MCP tool (secondary — include if time allows)
Add `log_work` to `tools.py` so the user can also log via Claude chat. Keep it **thin**:
accept already-structured entries (Claude resolves cases/people itself using the existing
`search` tool, exactly like `import_case` does) and call `db.create_worklog`. Then:
- Add an input model `LogWorkInput` to `schemas/inputs.py`.
- Document it in `MCP_INSTRUCTIONS` (`main.py`, tools-overview section ~lines 30–41) —
  this string is hand-maintained and required.

### 5.8 Dockerfile
**No change needed.** All new files land in already-copied directories (`db/`, `routes/`,
`services/`, `schemas/`). (Only update the Dockerfile if you add a brand-new top-level
file or directory.)

---

## 6. Frontend Implementation

Repeatable order (per CLAUDE.md): **types → service → components → page → wire-in.**

### 6.1 Types — `frontend/src/types/worklog.ts`
```ts
export interface WorklogEntry {
  id: number
  case_id: number | null
  case_name: string | null
  short_name: string | null
  minutes: number
  description: string
  raw_reference: string | null
  activity_date: string
  created_at: string
  people: { id: number; name: string }[]
}
export interface ParsedWorklogEntry {
  description: string
  minutes: number
  case_id: number | null
  case_guess: string | null
  person_ids: number[]
  people: { id: number; name: string }[]
  raw_reference: string
}
```

### 6.2 Service — `frontend/src/services/worklog.ts`
Mirror `services/cases.ts` (`apiFetch` from `@/lib/api`). Functions:
`parseWorklog(transcript, logDate)`, `saveWorklog(payload)`,
`getWorklogByCase(caseId)`, `getWorklogByPerson(personId)`, and (optional)
`updateWorklogEntry`, `deleteWorklogEntry`.

### 6.3 Page — `frontend/src/pages/worklog/index.tsx` (+ `components/`)
A dedicated page (co-located feature module). Flow:
1. **Compose:** a large `<Textarea>` + a date picker (defaults to today). A "Parse"
   button. (Add a small hint that they can dictate with their phone keyboard's mic.)
2. On Parse → `useMutation(parseWorklog)`; show a loading state.
3. **Review:** render the parsed entries as an **editable list**
   (`components/worklog-review.tsx`):
   - Each row: editable description, a `minutes` input (or quick chips: 15/30/60/90/morning),
     a **case combobox** (searchable, prefilled with the match; shows `case_guess` as a
     warning chip when `case_id` is null), and a **people multi-select**.
   - Running **total for the day** displayed at the top.
   - Use shadcn `Command`/`Combobox`, `Input`, `Badge`, `Button`. Check exact APIs via the
     shadcn MCP. **Square corners**, Hugeicons, semantic tokens.
4. **Save:** `useMutation(saveWorklog)` → on success, clear/redirect and invalidate any
   relevant queries. Toast confirmation.

Keep mislink-fixing to a **single glance** — do not gate saving behind required fields
(unmatched entries save fine with `case_id = null`).

### 6.4 Case detail card — `frontend/src/pages/cases/components/case-work-log.tsx`
`useQuery(["worklog-by-case", caseId], () => getWorklogByCase(caseId))`. Render entries
grouped by `activity_date` (use the existing `frontend/src/lib/datetime.ts` helpers —
`formatDateHeader`, `getDateKey`), each showing description, minutes, and people chips;
show a **total time** for the case at the card header. Mount it in
`frontend/src/pages/cases/detail.tsx` near `<CaseActivityFeed />` (~line 315).
Recommendation: **always-on** (don't gate behind `feature_toggles`).

### 6.5 Contact "Interactions" section — in `contact-detail-dialog.tsx`
Add a section (`useQuery(["worklog-by-person", personId], ...)`) listing the activities
that named this person, by date, each linking to its case. Place it alongside the
existing SMS / roles sections.

### 6.6 Wire-in (locate these files first)
- **Router:** add a `/log` route pointing at `pages/worklog/index.tsx` (React Router v7 —
  find the route table, likely `App.tsx` or a dedicated router file).
- **Header/nav:** add a global "Log my day" button (Hugeicons mic/pencil icon) in the app
  header/sidebar (`frontend/src/components/layout/`). It navigates to `/log`.

---

## 7. Build Sequence (recommended order)

1. `models.py` → add the three models (+ relationships).
2. `alembic revision --autogenerate -m "add worklog tables"` → review → `alembic upgrade head`.
3. `schemas/inputs.py` + `schemas/outputs.py` → add the models.
4. `db/worklog.py` → CRUD/queries; export in `db/__init__.py`.
5. `services/worklog_extractor.py` → the LLM parse.
6. `routes/worklog.py` → endpoints; register in `routes/__init__.py` (before static).
7. (Optional) `tools.py` `log_work` + `MCP_INSTRUCTIONS` in `main.py`.
8. Restart backend with `/dev`; smoke-test the API with `curl` (parse → save → by-case → by-person).
9. Frontend: types → service → review component → page → case card → contact section → router + header.
10. `cd frontend && npm run type-check && npm run build`; visual pass via `/dev`.

---

## 8. Verification Checklist

**Backend**
- [ ] `alembic upgrade head` applies cleanly; `alembic check` reports models in sync.
- [ ] `POST /api/v1/worklog/parse` with a multi-case memo returns multiple entries with
      sane minutes and correct case/person matches; an unknown case → `case_id null` +
      `case_guess` populated.
- [ ] `POST /api/v1/worklog` persists VoiceLog + entries + people junction in one txn.
- [ ] `GET /api/v1/worklog/by-case/{id}` and `/by-person/{id}` return correct data + totals.
- [ ] Token usage recorded (row in `token_usage_log` with `source='worklog_extractor'`).
- [ ] Unauthed requests get 401 (auth dependency present on every route).

**Frontend**
- [ ] `npm run type-check` and `npm run build` pass.
- [ ] `/log` page: type a memo → Parse → editable review → fix a mislink → Save → toast.
- [ ] Case detail shows the Work Log card with grouped-by-day entries and a total.
- [ ] Contact dialog shows the Interactions section.
- [ ] Square corners, Hugeicons, semantic color tokens, `@/` imports throughout.

**Behavioral (the philosophy)**
- [ ] "Had a call with X" with no duration → ~30 min, no prompt for clarification.
- [ ] "Spent the morning on Y" (sole morning item) → ~3.5–4 hrs.
- [ ] A memo mixing several cases fans out correctly; the day isn't double-counted.

---

## 9. Open Decisions for the Implementer

1. **Active-case scope for matching context.** Pull *all* non-closed cases, or only the
   logged-in user's cases (`attorney_ids`/`paralegal_ids`)? Recommendation: the user's
   cases first; fall back to all if the count is small. Keep the candidate list lean to
   control tokens (prompt-cache it if large).
2. **Editing/deleting entries after save** (PATCH/DELETE endpoints + UI) — listed as
   optional v1.1. Decide whether to ship in v1.
3. **MCP `log_work` tool** — secondary. Ship if time allows; it makes logging-via-Claude
   possible and fits the MCP-first architecture.
4. **`minutes` display format** — store integer minutes; render as "1h 30m" / "30m" via a
   small formatter in `frontend/src/lib/`.
5. **Multi-user.** `created_by` is captured. Decide whether case/contact views show
   everyone's entries or filter to the current user (the firm is small; default to
   showing all, label with initials if needed).

---

## 10. Guardrails (from CLAUDE.md — don't trip these)

- **UTC in the DB**, Pacific for display. `DateTime(timezone=True)` everywhere;
  `datetime.now(timezone.utc)`/`func.now()` for writes; never bare `datetime.now()`.
- **Route order:** new routes before `register_static_routes` (SPA catch-all is last).
- **MCP_INSTRUCTIONS** is hand-maintained — update it if you add the MCP tool.
- **Production runs `-w 1`** — irrelevant here (no in-memory state added), just don't
  change it.
- **Square corners**, **Hugeicons** (not Lucide), **`@/` imports**, **kebab-case files**,
  semantic color tokens. Use the **shadcn MCP** + **Context7** to confirm component APIs
  before writing UI.
- Never push to `main`; this work stays on `claude/voice-log-case-contact-Qgp6Y`.
