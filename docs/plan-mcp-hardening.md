# Plan: MCP surface hardening

Status: **not started**. Written 2026-08-27 from a comparison against the MCP
conventions in two sibling repos (`hillside_assistant`, `personal_journal_app`).

This plan is self-contained — it does not require reading those repos. Where a
convention was borrowed, the rationale is restated here.

The work is five independent phases. **Phases 1 and 2 are bug fixes and should
land first**; 3–5 are design improvements that can be done separately or
dropped. Nothing here changes the database schema, the SQLAlchemy models, or
Alembic. Do not "improve" the schema layer as part of this — it was reviewed
and is in good shape.

---

## The problem in one sentence

`schemas/common.py` is the single source of truth for the app's enums **in
code**, and `db/validation.py` already derives from it — but every
*model-facing* statement of those same vocabularies is hand-typed prose, in
four separate places, and three of them have already drifted.

The four prose homes today:

| # | Location | Lines | What it states |
|---|---|---|---|
| 1 | `main.py:26` `MCP_INSTRUCTIONS` | ~45 | tool overview, enums, roles, workflow |
| 2 | `mcp_stdio.py:23` `MCP_INSTRUCTIONS` | ~45 | **a second copy of the same string** |
| 3 | `services/chat/modes.py` `system_prompt_addition` × 10 | ~366 | per-mode guidance, restates enums |
| 4 | `tools.py` docstrings (esp. `import_case`, 153 lines) | ~250 | per-tool contract, restates enums |

Confirmed drift as of this writing:

- **`main.py` and `mcp_stdio.py` already disagree.** The `manage_case` line in
  `main.py` documents `intake_id`; the `mcp_stdio.py` copy does not.
- **Judge roles are wrong in the instructions.** `main.py:44` and
  `mcp_stdio.py` advertise `"Judge", "Magistrate Judge", "Presiding", "Panel"`.
  The actual Literal at `schemas/common.py:38` is
  `Presiding | Magistrate | Panel | Other`. Three of the four advertised values
  fail client-side schema validation on `manage_proceeding`.
- **Case statuses are wrong in `case_setup` chat mode.**
  `services/chat/modes.py:254` lists
  `Pre-Filing, Filing, Discovery, Trial Prep, Trial, Post-Trial, Settled, Closed`.
  `Filing`, `Trial Prep`, and `Settled` are not in `CaseStatus`, and 6 real
  statuses are missing. This is the mode whose own prompt calls it "your most
  important task".
- **The tool overview is stale.** `MCP_INSTRUCTIONS` lists 10 tools; 21 are
  registered. Missing: `calculate_deadline`, `manage_case_staff`,
  `manage_judge`, `list_jurisdictions`, `create_jurisdiction`, `manage_intake`,
  `merge_persons`, `reschedule_overdue`, `recommend_trial_slots`.

Roles (`plaintiff`, `opposing_counsel`, …) are currently *correct* in the prose,
but are hand-typed against `DEFAULT_ROLES` in `db/validation.py:54` and will
drift the same way.

---

## Phase 1 — Fix the judge-role vocabulary (bug)

**This is a live data-integrity bug with an existing workaround trail**, not a
cosmetic issue. Do this first and do it as its own commit.

### What's broken

`proceeding_judges.role` is an **unconstrained free-text column** (see
`models.py:827` `ProceedingJudge` — no CheckConstraint, no enum). Three writers
disagree about its vocabulary:

| Writer | Value written | In `JudgeRole` Literal? |
|---|---|---|
| `manage_proceeding(action="add_judge")` with explicit `judge_role` | `Presiding`/`Magistrate`/`Panel`/`Other` | yes |
| `tools.py:1405` fallback when `judge_role` omitted | `"Judge"` | **no** |
| `db/import_case.py:430-433` auto-detect | `"Magistrate Judge"` / `"Judge"` | **no** |

Four readers then cope with the mess, inconsistently:

- `db/cases.py:121` — `COALESCE(pj.role, 'Judge') != 'Magistrate Judge'`.
  **Exact match.** A row stored as `"Magistrate"` (the *valid* Literal value)
  is not excluded, so the magistrate is shown as the case's presiding judge in
  the case list.
- `db/trial_calendar.py:44` — `NOT ILIKE '%magistrate%'`. Substring; correct.
- `services/pdf_generator.py:538` and `services/docx_generator.py:489` —
  substring on `'magistrate'`; correct.
- `frontend/src/pages/cases/components/case-proceedings-card.tsx:41` and
  `proceedings-modal.tsx:32` — `j.role === "Magistrate Judge"`. **Exact match.**
  A row stored as `"Magistrate"` renders with no "Mag." prefix.

So the one value the Pydantic schema *forces* clients to send is the value the
case list query and both frontend components fail to recognize.

### Steps

1. **Decide the canonical vocabulary.** Recommendation: widen the Literal to
   accept what the system actually uses and displays, rather than narrowing the
   data. In `schemas/common.py:38`:

   ```python
   JudgeRole = Literal["Judge", "Magistrate Judge", "Presiding", "Panel", "Other"]
   ```

   Rationale: `"Judge"` and `"Magistrate Judge"` are what the frontend renders,
   what `import_case` writes, and what both document generators were written
   against. `"Magistrate"` and the bare-`"Judge"`-absent Literal are the
   outliers. Widening is a one-line change; narrowing means a data migration
   plus touching four readers and two components.

   *If the team prefers the short forms instead*, then the frontend components
   and `db/cases.py:121` must be updated in the same commit and a data
   migration written — say so explicitly rather than doing half of it.

2. **Fix the unsafe reader regardless of which way step 1 goes.**
   `db/cases.py:121` must match the substring form used everywhere else:

   ```sql
   AND COALESCE(pj.role, '') NOT ILIKE '%magistrate%'
   ```

   Note the `COALESCE` default changes from `'Judge'` to `''` — with `NOT ILIKE`
   a NULL role should fall through as *not* a magistrate, which `''` gives.

3. **Remove the out-of-enum fallback.** `tools.py:1405` writes
   `data.judge_role or "Judge"`. Once `"Judge"` is in the Literal this is
   legal, but make the default explicit in the schema instead
   (`tools.py:288`, `judge_role: JudgeRole = "Judge"`) so the advertised
   default and the written default are the same fact.

4. **Audit existing rows before deploying.** Read-only:

   ```sql
   SELECT COALESCE(role, '<null>') AS role, count(*)
   FROM proceeding_judges GROUP BY 1 ORDER BY 2 DESC;
   ```

   If any `"Magistrate"` rows exist, they are currently mis-rendered in the
   frontend and mis-selected by `db/cases.py`. Normalize them to
   `"Magistrate Judge"` in a small Alembic data migration. If the count is
   zero, note that in the commit message and skip the migration.

### Acceptance

- `SELECT DISTINCT role FROM proceeding_judges` returns only values in the
  `JudgeRole` Literal.
- A case whose primary proceeding has both a district judge and a magistrate
  shows the district judge in the case list, the case-proceedings card, the
  trial calendar, and a generated PDF/DOCX caption.
- `manage_proceeding(action="add_judge", ..., judge_role="Magistrate Judge")`
  is accepted (it is currently rejected).

---

## Phase 2 — Generate the model-facing vocabularies

Kills the whole drift class and deletes a standing CLAUDE.md maintenance rule.

### Steps

1. **Create `mcp_instructions.py` at the project root.** One module that builds
   the instruction text from the constants. Sketch:

   ```python
   """Model-facing MCP instructions, GENERATED from schemas/common.py.

   The enum vocabularies here are built from the same Literals the Pydantic
   input models validate against, so the text can't advertise a value the
   schema rejects. Prose that states JUDGMENT (what a good deadline note
   looks like, when to skip a vacated event) is hand-written below; prose
   that states a VOCABULARY is interpolated. Don't type an enum value into
   this file by hand.
   """
   from schemas import (
       CASE_STATUS_LIST, TASK_STATUS_LIST, URGENCY_LIST,
       INTAKE_STATUS_LIST, JUDGE_ROLE_LIST,
   )
   from db.validation import DEFAULT_ROLES

   def _q(values): return ", ".join(f'"{v}"' for v in values)

   def _roles_by_category() -> str:
       ...  # group DEFAULT_ROLES by category, one line each

   VALID_VALUES_BLOCK = f"""\
   VALID VALUES (enforced — invalid values return an error with the valid options):
   - Case status: {_q(CASE_STATUS_LIST)}
   - Task status: {_q(TASK_STATUS_LIST)}
   - Urgency: {_q(URGENCY_LIST)}
   - Intake status: {_q(INTAKE_STATUS_LIST)}
   - Judge roles: {_q(JUDGE_ROLE_LIST)}
   """

   ROLES_BLOCK = f"""\
   ROLES SYSTEM (unified person-role management):
   Persons are assigned to cases via manage_case_role with role names
   (accepts both snake_case and space-separated):
   {_roles_by_category()}
   """

   MCP_INSTRUCTIONS = "\n\n".join([_HEADER, _TOOLS_OVERVIEW,
                                   VALID_VALUES_BLOCK, ROLES_BLOCK,
                                   _JUDGES_BLOCK, _PROCEEDINGS_BLOCK,
                                   _DATA_ENTRY_BLOCK])
   ```

   Keep the hand-written blocks (`_JUDGES_BLOCK`, `_DATA_ENTRY_BLOCK`, …) as
   plain module constants in the same file. The split to hold to: **structure
   and vocabulary are interpolated, judgment is written.**

2. **Delete both copies of the string.** `main.py:26` and `mcp_stdio.py:23`
   become `from mcp_instructions import MCP_INSTRUCTIONS`. This alone fixes the
   already-drifted `manage_case`/`intake_id` line.

3. **Generate the tool overview too.** `_TOOLS_OVERVIEW` currently lists 10 of
   21 tools by hand. Build it from the registered tools instead — `register_tools`
   can be run against a throwaway `FastMCP` instance the way
   `services/chat/tools.py:16` already does, and each tool's one-line summary is
   the first line of its docstring. A tool added tomorrow appears with no edit
   here.

   If deriving the overview turns out to be awkward (e.g. first docstring lines
   read poorly as a list), fall back to a hand-written list **plus** the boot
   assertion in Phase 5, which will fail loudly when it goes stale. Do not
   leave it hand-written and unchecked.

4. **Reuse the same blocks in the chat prompts.** `services/chat/modes.py`
   should import `VALID_VALUES_BLOCK` / `ROLES_BLOCK` and interpolate them into
   the `system_prompt_addition` strings that need them, rather than restating.
   In particular `case_setup` (`modes.py:254`) and `people`
   (`modes.py:101-104`).

   Two rules to state in a comment there so it doesn't regress: **each vocabulary
   is stated once, in the block that owns it**, and a mode's own prose covers
   only what is specific to that mode.

5. **Update the Dockerfile.** `mcp_instructions.py` is a new root-level `.py`
   file — add it to the `COPY main.py models.py tools.py ... ./` line. Per
   `CLAUDE.md` this is the #1 cause of deploy failures in this repo; forgetting
   it means `ModuleNotFoundError` on boot.

6. **Update `CLAUDE.md`.** The section "MCP_INSTRUCTIONS must be updated when
   MCP tools change" is now half-obsolete. Rewrite it: enum values and the tool
   list are generated and need no action; hand-maintained blocks are the
   workflow/judgment prose, and those still need updating when a tool's
   *behavior* changes.

### Acceptance

- `grep -rn '"Pre-Filing"\|"Awaiting Atty Review"\|"Magistrate"' main.py mcp_stdio.py services/chat/modes.py`
  returns nothing (no hand-typed enum values in prose).
- `python3 -c "from mcp_instructions import MCP_INSTRUCTIONS; print(MCP_INSTRUCTIONS)"`
  prints all 13 case statuses, all 21 tools, and only valid judge roles.
- `main.py` and `mcp_stdio.py` cannot disagree, because there is one string.

---

## Phase 3 — Type the `import_case` payload

`tools.py:507` takes `data: dict` and describes the entire structure in a
**153-line docstring** (`tools.py:511-663`). Every other tool takes a Pydantic
input model. This is the most complex payload on the surface and the only
untyped one.

The cost is not stylistic. A misspelled key — `case.date_of_injury` typed as
`date_of_injuries` — is silently ignored by `db/import_case.py`, which reads
with `.get()` throughout. The import "succeeds" and returns created IDs; the
DOI is just missing. With a real schema, the client rejects the call and names
the field.

Borrowed convention: *structure lives in the schema, judgment lives in the
docstring.* Adding a field to a payload means adding it to the model, not to
the prose.

### Steps

1. **Add nested models to `schemas/inputs.py`.** Derive the shapes from what
   `db/import_case.py` actually reads — the docstring is close but is not the
   authority. Roughly:

   ```
   ImportCaseInput
     ├── case: ImportCaseCase          (case_name required; status: CaseStatus = "Signing Up")
     ├── persons: list[ImportPerson]   (name required; role: str; phones/emails: list[ContactInfo];
     │                                  the "phone"/"email" scalar shortcuts; attributes: dict; …)
     ├── proceedings: list[ImportProceeding]
     │     └── judges: list[ImportJudge]  (name required; role: Optional[JudgeRole])
     ├── events: list[ImportEvent]     (date + description required)
     ├── notes: list[ImportNote]
     ├── activities: list[ImportActivity]
     └── attorney_ids: list[int]
   ```

   Reuse `ContactInfo` from `schemas/common.py:74` for phones/emails, and
   `CaseStatus` / `JudgeRole` for the enums — do not redeclare them.

   `attributes` stays a free-form `dict` **on purpose**: it is JSONB whose keys
   vary by role, and a strict model would reject valid extensions. Put a
   comment saying so, or the next reader will "fix" it.

2. **Keep `db.import_case(data: dict)` unchanged.** Call it with
   `data.model_dump(exclude_none=True)`. This keeps the change to the MCP
   surface and avoids touching the transaction logic. Verify `exclude_none` is
   right — `db/import_case.py` uses `.get()` with defaults throughout, so
   absent-vs-None should be equivalent, but check the `color` and `status`
   paths specifically since both have "auto-assign if omitted" behavior.

3. **Cut the docstring to judgment only.** Delete the `INPUT SCHEMA` block and
   the `VALID VALUES` lists — both are now in the schema. Keep, in ~30 lines:
   the atomicity guarantee, the judge fuzzy-matching behavior and what
   `unresolved_judges` means, the note that judges are not persons, the
   jurisdiction match-or-create behavior, and the data-entry guidance
   ("skip vacated events", "include the deponent name").

4. **Re-check the `import_case` chat blacklist.** `services/chat/tools.py:21`
   excludes it with the comment "Too complex for chat". With a real schema that
   may no longer hold — but changing it is out of scope here. Leave the
   blacklist alone and note the question in the commit message.

### Acceptance

- `import_case` with a misspelled top-level or nested key is rejected by schema
  validation naming the field path, instead of silently importing.
- An import payload that worked before this change still works (test with a
  realistic multi-person, multi-proceeding, multi-judge payload).
- `tools.py` `import_case` docstring is under ~40 lines.

---

## Phase 4 — Tool annotations

Every tool currently advertises the MCP default `destructiveHint: true`
(`grep -c annotations tools.py` → 0). To a client, `search` and `get_details`
look exactly as dangerous as `manage_case`, so the connector can only prompt on
everything or on nothing.

### Steps

1. **Add the four constants** near the top of `tools.py`:

   ```python
   READ_ONLY = {"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False}
   WRITE = {"destructiveHint": False, "idempotentHint": False, "openWorldHint": False}
   WRITE_IDEMPOTENT = {"destructiveHint": False, "idempotentHint": True, "openWorldHint": False}
   DESTRUCTIVE = {"destructiveHint": True, "idempotentHint": True, "openWorldHint": False}
   ```

   With a comment stating that these are **advisory metadata, not enforcement** —
   the real guard is auth — and that the MCP default for `destructiveHint` is
   `true`, which is why declaring them matters.

2. **Tag the unambiguous reads** as `READ_ONLY`: `get_current_time`,
   `calculate_deadline`, `list_staff`, `search`, `get_details`,
   `list_jurisdictions`, `recommend_trial_slots`.

3. **Tag the unambiguous writes**: `create_jurisdiction` → `WRITE`;
   `import_case` → `WRITE`; `merge_persons` → `DESTRUCTIVE` (it is
   irreversible); `reschedule_overdue` → `WRITE`.

4. **The `manage_*` tools are the honest problem.** Each does
   create + update + delete behind an `action` Literal, so the truthful
   annotation for all nine is `DESTRUCTIVE` — which is most of the surface and
   tells a client almost nothing.

   **Do not undo the tool consolidation to fix this.** Going from 49 tools to
   13 was a deliberate call and the `action` field is a validated Literal, not
   a free string. Tag the nine `manage_*` tools `DESTRUCTIVE` for now and leave
   the design question to Phase 4b.

### Phase 4b (optional, separate decision)

Split *only* the delete branch out of each `manage_*` tool into a narrow
`delete_event` / `delete_task` / `delete_note` / … Rationale, borrowed: an
`action` string is a thing the model can get wrong on an irreversible call, and
splitting it lets the remaining ~90% of the surface annotate honestly as
`WRITE` rather than `DESTRUCTIVE`.

Costs to weigh before doing this: +9 tools on the surface (13 → 22), edits to
the `services/chat/` mode tool lists, and `MCP_INSTRUCTIONS` prose. Worth
raising with the team; not obviously worth doing.

### Acceptance

- Every `@mcp.tool()` in `tools.py` passes an `annotations=` argument.
- No tool is annotated `readOnlyHint: True` while calling anything in `db/`
  that writes.

---

## Phase 5 — Boot assertion on hand-listed tool names

`services/chat/tools.py` hand-lists tool names in `BLACKLIST` (line 21),
`PROCEEDINGS_ONLY` (line 26), and `EAGER_TOOLS` (line 33); `services/chat/modes.py`
lists them per mode. Every one of these is a bare string. Rename a tool and it
silently vanishes from its mode — no error, no log, just a capability that
quietly stops being offered.

All names are currently valid (checked against the 21 registered tools), so
this is pure insurance.

### Steps

1. In `services/chat/tools.py`, after `register_tools(_mcp)` at line 17, add:

   ```python
   def _assert_tool_names_exist() -> None:
       """Fail the boot if a hand-listed tool name no longer exists.

       BLACKLIST / PROCEEDINGS_ONLY / EAGER_TOOLS and the per-mode tool lists
       are bare strings. A renamed tool would drop out of its mode silently —
       the chat would simply stop offering a capability, with nothing in the
       logs. Cheap to check, and the failure mode it prevents is invisible.
       """
       registered = set(_mcp._tool_manager._tools)   # confirm the accessor for the pinned FastMCP version
       listed = BLACKLIST | PROCEEDINGS_ONLY | set().union(*EAGER_TOOLS.values())
       listed |= {n for cfg in CHAT_MODES.values() for n in cfg.get("tools", [])}
       missing = sorted(listed - registered)
       if missing:
           raise RuntimeError(
               f"Chat config references tools that are not registered: {missing}. "
               f"Rename them here or restore them in tools.py."
           )

   _assert_tool_names_exist()
   ```

2. **Verify the accessor** for how the pinned FastMCP version exposes
   registered tool names — `_tool_manager._tools` is private and may differ.
   If there is a public `list_tools()`, prefer it, even if it means making the
   check `async` and running it at app startup instead of at import.

3. Import `CHAT_MODES` from `.modes` (watch for a circular import — `modes.py`
   may already import from `tools.py`; if so, put the assertion in
   `services/chat/__init__.py` instead, after both are loaded).

### Acceptance

- Renaming any tool in `tools.py` without updating `services/chat/` fails the
  boot with a message naming the tool. Verify by temporarily renaming one.

---

## Suggested commit sequence

| # | Commit | Phase |
|---|---|---|
| 1 | `fix(judges): unify judge role vocabulary across writers and readers` | 1 |
| 2 | `refactor(mcp): generate instructions from schema constants` | 2 |
| 3 | `feat(mcp): type the import_case payload` | 3 |
| 4 | `feat(mcp): declare tool annotations` | 4 |
| 5 | `chore(chat): assert hand-listed tool names at boot` | 5 |

Per `CLAUDE.md`: work locally, push to remote `staging` to test
(`git push origin <branch>:staging`), then open a PR `staging` → `main` for a
human to merge. Do not push to `main`.

## Explicitly out of scope

- **The schema layer.** SQLAlchemy `models.py` + Alembic is the right setup and
  is better than what the sibling repos do. No changes to models, migrations,
  or the DB layer except the `db/cases.py:121` fix and the optional
  `proceeding_judges.role` normalization in Phase 1.
- **Undoing the Feb 2026 tool consolidation** (49 → 13 tools). See Phase 4b.
- **Moving prompts out of code into runtime-read files.** Considered and
  rejected: most of `MCP_INSTRUCTIONS` is enum/tool *reference*, which should be
  generated rather than filed. The ~366 lines of behavioral prose in
  `services/chat/modes.py` are the only real candidate, and only if
  non-developers need to edit them.
