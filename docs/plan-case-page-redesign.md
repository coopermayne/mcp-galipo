# Case Page Redesign Plan

## Goals
1. **Tighten the layout** - Reduce whitespace and make information more scannable
2. **Structured people sections** - Permanent sections for each role category
3. **Smart person adding** - Autocomplete existing people + inline create new
4. **Predictable layout** - Users always know where to find specific information

---

## Current Problems
- Too much vertical spread/whitespace
- Contacts section is a generic catch-all grid
- No visual hierarchy for different role types
- Adding contacts requires selecting role from dropdown (no context)
- Can't quickly see if a case has a mediator, judge, opposing counsel, etc.

---

## Proposed Layout

### Header Section (Compact)
```
┌─────────────────────────────────────────────────────────────────────┐
│ Case Name                                    [Status Badge] [Court] │
│ Case #: 24STCV12345                         DOI: 01/15/2024         │
└─────────────────────────────────────────────────────────────────────┘
```
- Single row header with key identifiers
- Status and court inline rather than separate panels

### Main Content: Two-Column Layout

#### Left Column (60%) - Case Info & People

**Case Summary** (collapsible, starts collapsed if empty)
```
┌─────────────────────────────────────┐
│ Summary                         [▼] │
│ Brief description of case...        │
└─────────────────────────────────────┘
```

**Clients Section** (always visible)
```
┌─────────────────────────────────────┐
│ Clients                        [+]  │
├─────────────────────────────────────┤
│ ★ John Smith  📞 555-1234  ✉ j@...  │
│   Jane Doe    📞 555-5678           │
│ [+ Add client...]                   │
└─────────────────────────────────────┘
```
- Compact single-line per client
- Star for primary client
- Inline add with autocomplete

**Defendants Section** (always visible)
```
┌─────────────────────────────────────┐
│ Defendants                     [+]  │
├─────────────────────────────────────┤
│ City of Los Angeles                 │
│ Officer John Doe, Badge #1234       │
│ [+ Add defendant...]                │
└─────────────────────────────────────┘
```

**Legal Team Sections** (grouped)
```
┌─────────────────────────────────────┐
│ LEGAL                               │
├─────────────────────────────────────┤
│ Opposing Counsel                    │
│   Smith & Jones LLP - Bob Smith     │
│   [+ Add...]                        │
├─────────────────────────────────────┤
│ Co-Counsel                          │
│   (none)  [+ Add...]                │
└─────────────────────────────────────┘
```

**Court Section** (grouped)
```
┌─────────────────────────────────────┐
│ COURT                               │
├─────────────────────────────────────┤
│ Judge                               │
│   Hon. Jane Wilson, Dept 5A         │
│   [+ Add...]                        │
├─────────────────────────────────────┤
│ Magistrate Judge                    │
│   (none)  [+ Add...]                │
└─────────────────────────────────────┘
```

**Experts Section** (grouped)
```
┌─────────────────────────────────────┐
│ EXPERTS                             │
├─────────────────────────────────────┤
│ Plaintiff Experts                   │
│   Dr. Smith (Biomechanics)          │
│   [+ Add...]                        │
├─────────────────────────────────────┤
│ Defense Experts                     │
│   (none)  [+ Add...]                │
└─────────────────────────────────────┘
```

**Other Contacts Section** (grouped)
```
┌─────────────────────────────────────┐
│ OTHER CONTACTS                      │
├─────────────────────────────────────┤
│ Mediator                            │
│   (none)  [+ Add...]                │
├─────────────────────────────────────┤
│ Witnesses                           │
│   (none)  [+ Add...]                │
├─────────────────────────────────────┤
│ Lien Holders                        │
│   Kaiser Permanente                 │
│   [+ Add...]                        │
└─────────────────────────────────────┘
```

#### Right Column (40%) - Dates & Activity

**Key Dates Panel** (compact)
```
┌─────────────────────────────────┐
│ Key Dates                       │
├─────────────────────────────────┤
│ Trial:      03/15/2025          │
│ MSJ Hearing: 02/01/2025         │
│ Discovery:  01/30/2025          │
└─────────────────────────────────┘
```
- Shows starred deadlines only
- Link to full deadlines tab

**Upcoming Tasks** (compact)
```
┌─────────────────────────────────┐
│ Upcoming Tasks              [→] │
├─────────────────────────────────┤
│ ● Draft opposition (due 1/25)   │
│ ● Review discovery (due 1/28)   │
└─────────────────────────────────┘
```
- Top 3-5 tasks
- Link to full tasks tab

**Recent Notes** (compact)
```
┌─────────────────────────────────┐
│ Recent Notes                [→] │
├─────────────────────────────────┤
│ 1/20: Called opp counsel re...  │
│ 1/18: Client confirmed depo...  │
└─────────────────────────────────┘
```
- Most recent 2-3 notes
- Link to full notes tab

---

## Person Section Categories

### Permanent Sections (always show, even if empty)
| Section | Roles | Person Type on Create |
|---------|-------|----------------------|
| Clients | Client | client |
| Defendants | Defendant | defendant |
| Opposing Counsel | Opposing Counsel | attorney |
| Co-Counsel | Co-Counsel, Referring Attorney | attorney |
| Judge | Judge | judge |
| Magistrate Judge | Magistrate Judge | judge |
| Plaintiff Experts | Expert - Plaintiff | expert |
| Defense Experts | Expert - Defendant | expert |
| Mediator | Mediator | mediator |
| Witnesses | Witness | witness |
| Lien Holders | Lien Holder | lien_holder |

### Optional Sections (show only if populated, can add via "Other")
- Guardian Ad Litem
- Insurance Adjuster
- Interpreter
- Process Server

---

## Autocomplete Person Picker Component

### Behavior
1. User clicks "[+ Add...]" in a section
2. Inline input appears with autocomplete dropdown
3. As user types, show matching existing persons of appropriate type
4. Options:
   - Select existing person → assign to case
   - "Create new: [typed name]" → creates person with section's type, then assigns
5. ESC or click away cancels

### UI Mock
```
┌─────────────────────────────────────┐
│ Opposing Counsel                    │
│   Smith & Jones LLP - Bob Smith     │
│   ┌─────────────────────────────┐   │
│   │ John_                    🔍 │   │
│   ├─────────────────────────────┤   │
│   │ John Adams (Adams Law)      │   │
│   │ John Baker (Baker & Co)     │   │
│   │ ─────────────────────────── │   │
│   │ + Create "John" as attorney │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Implementation Details
- Search API: `searchPersons(name, person_type)`
- Debounce input (300ms)
- Show max 5 results + create option
- Filter out persons already on case
- Pre-filter by person_type appropriate for section

---

## Component Structure

```
CaseDetail/
├── CaseHeader.tsx           # Compact header with status, court, case #
├── CaseSummary.tsx          # Collapsible summary section
├── PersonSection.tsx        # Reusable section for any role type
├── PersonSectionGroup.tsx   # Groups related sections (Legal, Court, etc.)
├── PersonPicker.tsx         # Autocomplete add component
├── PersonRow.tsx            # Single-line person display
├── KeyDatesPanel.tsx        # Right column dates
├── UpcomingTasksPanel.tsx   # Right column tasks preview
├── RecentNotesPanel.tsx     # Right column notes preview
└── CaseDetail.tsx           # Main orchestrator
```

---

## Implementation Steps

### Phase 1: Layout Restructure
1. [ ] Create new `CaseHeader` component with compact layout
2. [ ] Refactor main content to 60/40 two-column grid
3. [ ] Create `KeyDatesPanel`, `UpcomingTasksPanel`, `RecentNotesPanel` for right column
4. [ ] Reduce padding/margins throughout (py-4 → py-2, gap-6 → gap-3, etc.)

### Phase 2: Person Section Components
5. [ ] Create `PersonRow` component for compact single-line person display
6. [ ] Create `PersonSection` component with header, list, and add trigger
7. [ ] Create `PersonSectionGroup` for grouping related sections
8. [ ] Define section configuration (roles, types, labels)

### Phase 3: Person Picker
9. [ ] Create `PersonPicker` autocomplete component
10. [ ] Add search endpoint or use existing `searchPersons` with type filter
11. [ ] Implement create-new-person flow within picker
12. [ ] Handle assignment after selection/creation

### Phase 4: Integration & Polish
13. [ ] Replace current Clients section with new PersonSection
14. [ ] Replace current Defendants section
15. [ ] Replace current Contacts grid with grouped PersonSections
16. [ ] Add empty state styling for sections
17. [ ] Test all flows (add existing, create new, remove)
18. [ ] Responsive adjustments (stack columns on mobile)

---

## Spacing Guidelines

| Element | Current | New |
|---------|---------|-----|
| Section padding | py-6 | py-3 |
| Section gap | gap-6 | gap-4 |
| Card padding | p-6 | p-4 |
| Person row height | ~80px | ~36px |
| Section header | text-lg mb-4 | text-sm font-semibold mb-2 |

---

## Data Flow

```
CaseDetail (fetches case with persons)
    │
    ├── Groups persons by role
    │
    └── Renders PersonSectionGroups
            │
            └── PersonSection (receives filtered persons + role config)
                    │
                    ├── PersonRow (for each person)
                    │
                    └── PersonPicker (on add click)
                            │
                            ├── searchPersons(query, type)
                            │
                            └── onSelect:
                                ├── existing → assignPersonToCase()
                                └── new → createPerson() → assignPersonToCase()
```

---

## API Considerations

### Existing Endpoints (sufficient)
- `GET /cases/:id` - returns case with persons array
- `POST /persons` - create new person
- `POST /cases/:id/persons` - assign person to case
- `DELETE /cases/:id/persons/:personId` - remove from case
- `GET /persons/search` - search persons (may need type filter param)

### Potential Enhancement
- Add `person_type` filter to search endpoint if not present
- Or filter client-side from search results

---

## Success Metrics
- Case page renders in single viewport (no scroll for basic info)
- User can identify judge/opposing counsel/mediator at a glance
- Adding a person takes <3 clicks
- Empty sections clearly indicate what's missing
