# Invoices Feature — Implementation Spec

## Overview

Add a drag-and-drop invoice management system to Galipo. Users drop invoice documents (PDFs/images) onto a case, AI extracts the key financial data, and the system tracks payment status and generates cover letters for checks.

---

## Data Model

### New Table: `invoices`

Add to `models.py` following existing patterns (see `Task`, `Event` as reference):

```
Invoice
├── id: Integer, primary key
├── case_id: Integer, FK → cases.id, NOT NULL
├── payee_person_id: Integer, FK → persons.id, nullable
│   (link to existing person in the system — experts, mediators, etc.)
├── payee_name: String, NOT NULL
│   (extracted name, kept even if linked to a person for the invoice-as-scanned record)
├── amount: Numeric(10, 2), NOT NULL
├── due_date: Date, nullable
├── received_date: Date, nullable (date invoice was received by the firm)
├── paid_date: Date, nullable (date payment was sent)
├── invoice_number: String, nullable
├── description: String, nullable (what the invoice is for — e.g., "IME report", "mediation session")
├── status: String, NOT NULL, default "Unpaid"
│   Literal values: "Unpaid", "Needs W-9", "Approved", "Paid"
├── check_number: String, nullable (for tracking once paid)
├── file_path: String, NOT NULL (path to stored file on disk)
├── file_name: String, NOT NULL (original filename)
├── ai_extracted_data: JSONB, nullable (raw AI extraction for audit/debugging)
├── notes: String, nullable
├── created_at: DateTime, server_default=CURRENT_TIMESTAMP
├── updated_at: DateTime, onupdate=CURRENT_TIMESTAMP
```

### Modify Existing: `persons` or `person_roles`

Add W-9 tracking fields to the `person_roles` table (since W-9 status is relevant per-vendor-relationship, and person_roles already has a JSONB `attributes` column):

**Option A (recommended):** Add W-9 fields into `person_roles.attributes` JSONB for roles in categories that receive payments (expert, mediator, etc.):
```json
{
  "hourly_rate": 450,
  "w9_on_file": true,
  "w9_received_date": "2025-11-15",
  "w9_file_path": "/data/w9s/person_42_w9.pdf"
}
```

This is consistent with how you already store `hourly_rate`, `bar_number`, etc. in attributes. No migration needed for the JSONB structure — just update the code that reads/writes attributes.

**Option B:** Add dedicated columns to `persons` table: `w9_on_file: Boolean`, `w9_received_date: Date`, `w9_file_path: String`. Simpler but less granular (W-9 is really per-vendor, not per-person).

Go with Option A unless there's a reason to prefer B.

### Alembic Migration

Generate after adding the Invoice model:
```bash
set -a && source .env && set +a
alembic revision --autogenerate -m "add invoices table"
alembic upgrade head
```

---

## File Storage Setup

**This is the first feature requiring persistent file storage.** Currently all file operations are in-memory (PDFs uploaded, processed, discarded). We need a storage directory on the Hetzner server.

### Storage Structure

```
/data/galipo/
├── invoices/
│   └── {case_id}/
│       └── {invoice_id}_{original_filename}
├── w9s/
│   └── {person_id}_w9_{timestamp}.pdf
```

### Configuration

Add to `.env` and `config.py` (Pydantic BaseSettings):
```python
STORAGE_DIR: str = "/data/galipo"  # Production path on Hetzner
# Local dev can use: STORAGE_DIR=./data
```

### Backend Utility

Create a small `services/storage.py` helper:
- `save_file(subdir: str, filename: str, content: bytes) -> str` — saves file, returns relative path
- `get_file_path(relative_path: str) -> Path` — resolves to absolute path
- `delete_file(relative_path: str)` — removes file
- Ensure subdirectories are created automatically (`os.makedirs(exist_ok=True)`)
- Sanitize filenames (strip path traversal, limit length)

### Dockerfile / Deployment

- Add a volume mount for `/data/galipo` in your Docker/deployment config so files persist across deploys
- Add `STORAGE_DIR` to `.env.example`
- The storage directory should NOT be inside the app directory (not in the git repo)

---

## Backend Implementation

### Schemas (`schemas/`)

**`schemas/common.py`** — add:
```python
InvoiceStatus = Literal["Unpaid", "Needs W-9", "Approved", "Paid"]
INVOICE_STATUS_LIST = list(get_args(InvoiceStatus))
```

**`schemas/inputs.py`** — add:
```python
class CreateInvoiceInput(BaseModel):
    case_id: int
    payee_person_id: Optional[int] = None
    payee_name: str
    amount: float
    due_date: Optional[str] = None
    received_date: Optional[str] = None
    invoice_number: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "Unpaid"
    notes: Optional[str] = None

class UpdateInvoiceInput(BaseModel):
    payee_person_id: Optional[int] = None
    payee_name: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[str] = None
    received_date: Optional[str] = None
    paid_date: Optional[str] = None
    invoice_number: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    check_number: Optional[str] = None
    notes: Optional[str] = None
```

**`schemas/outputs.py`** — add:
```python
class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: int
    payee_person_id: Optional[int]
    payee_name: str
    amount: float
    due_date: Optional[str]
    received_date: Optional[str]
    paid_date: Optional[str]
    invoice_number: Optional[str]
    description: Optional[str]
    status: str
    check_number: Optional[str]
    file_path: str
    file_name: str
    notes: Optional[str]
    created_at: str
    updated_at: Optional[str]
    # Include payee W-9 status (joined from person_roles)
    w9_on_file: Optional[bool] = None
```

### Database Layer (`db/invoices.py`)

New file following existing patterns in `db/tasks.py`:

- `add_invoice(case_id, payee_name, amount, file_path, file_name, ...) -> dict`
- `get_invoices(case_id=None, status=None, limit=20, offset=0) -> dict` — returns `{"invoices": [...], "total": N}`
- `get_invoice_by_id(invoice_id) -> dict`
- `update_invoice(invoice_id, **kwargs) -> dict`
- `delete_invoice(invoice_id) -> bool`

Include W-9 status in the query when `payee_person_id` is set — join to `person_roles.attributes` to check `w9_on_file`.

Don't forget to export from `db/__init__.py`.

### Routes (`routes/invoices.py`)

New file following existing patterns in `routes/tasks.py`:

```
GET    /api/v1/invoices?case_id=&status=&limit=&offset=    → list invoices
GET    /api/v1/invoices/{invoice_id}                        → get single invoice
POST   /api/v1/invoices/upload                              → upload file + create invoice (multipart)
PUT    /api/v1/invoices/{invoice_id}                        → update invoice
DELETE /api/v1/invoices/{invoice_id}                        → delete invoice + file
GET    /api/v1/invoices/{invoice_id}/cover-letter           → generate cover letter (returns DOCX or PDF)
GET    /api/v1/invoices/{invoice_id}/file                   → download original invoice file
```

**Upload endpoint** (`POST /api/v1/invoices/upload`):
1. Accept multipart form data: file + case_id
2. Save file to disk via `services/storage.py`
3. Send file to Claude API (vision) for data extraction
4. Return extracted data as JSON for user review (DO NOT auto-create the invoice)
5. Frontend shows a review/edit form pre-filled with extracted data
6. User confirms → frontend sends `POST /api/v1/invoices` with the confirmed data + file_path

Alternatively, combine into one step: upload extracts + creates the invoice, and the user edits afterward. Decide based on UX preference — the two-step approach (extract → review → save) is safer.

**Cover letter endpoint** (`GET /api/v1/invoices/{invoice_id}/cover-letter`):
- Loads a DOCX template from `templates/invoices/cover_letter.docx`
- Fills in variables using python-docx (same pattern as `services/docx_generator.py`)
- Returns the filled DOCX as a download

Register routes in `main.py` with `register_invoice_routes(mcp)`.

### AI Extraction (`services/invoice_extractor.py`)

New service that sends the uploaded file to Claude for structured data extraction:

```python
async def extract_invoice_data(file_path: str, file_name: str) -> dict:
    """
    Send invoice file to Claude Vision API.
    Returns: {
        "payee_name": str,
        "amount": float,
        "due_date": str or None,
        "invoice_number": str or None,
        "description": str or None,
        "line_items": [...] (optional, for reference)
    }
    """
```

- Use the Anthropic Python SDK (already a dependency — used for in-app chat)
- Read `ANTHROPIC_API_KEY` from config
- For PDFs: convert to images or use Claude's PDF support
- For images: send directly as base64
- Use a structured prompt asking for specific fields in JSON format
- Store raw extraction result in `ai_extracted_data` JSONB column for audit trail

### Cover Letter Template

Create `templates/invoices/cover_letter.docx` — a standard firm letter template with these merge fields:

| Variable | Source |
|----------|--------|
| `{firm_name}` | Config or hardcoded |
| `{firm_address}` | Config or hardcoded |
| `{date}` | Current date |
| `{payee_name}` | invoice.payee_name |
| `{payee_address}` | person.address (from linked person) |
| `{case_name}` | case.case_name |
| `{invoice_number}` | invoice.invoice_number |
| `{amount}` | invoice.amount (formatted as currency) |
| `{check_number}` | invoice.check_number |
| `{description}` | invoice.description |

Use python-docx to do the variable replacement — same approach as the existing `services/docx_generator.py`.

### W-9 Upload

Add a route for uploading W-9 documents to a person:

```
POST /api/v1/persons/{person_id}/w9    → upload W-9 file (multipart)
GET  /api/v1/persons/{person_id}/w9    → download W-9 file
```

This updates the person_role's `attributes` JSONB to set `w9_on_file: true`, `w9_received_date`, and `w9_file_path`.

---

## Frontend Implementation

### Types (`frontend/src/types/invoice.ts`)

```typescript
export interface Invoice {
  id: number
  case_id: number
  payee_person_id: number | null
  payee_name: string
  amount: number
  due_date: string | null
  received_date: string | null
  paid_date: string | null
  invoice_number: string | null
  description: string | null
  status: InvoiceStatus
  check_number: string | null
  file_path: string
  file_name: string
  notes: string | null
  w9_on_file: boolean | null
  created_at: string
  updated_at: string | null
}

export type InvoiceStatus = 'Unpaid' | 'Needs W-9' | 'Approved' | 'Paid'

export interface CreateInvoiceInput { ... }
export interface UpdateInvoiceInput { ... }
export interface InvoiceExtraction {
  payee_name: string
  amount: number
  due_date: string | null
  invoice_number: string | null
  description: string | null
}
```

### API Client (`frontend/src/api/invoices.ts`)

Follow patterns in `api/tasks.ts`:
- `getInvoices(params)` → `{ invoices: Invoice[], total: number }`
- `getInvoice(id)` → `Invoice`
- `uploadInvoice(file: File, caseId: number)` → `{ extraction: InvoiceExtraction, file_path: string }`
- `createInvoice(data)` → `{ success: boolean, invoice: Invoice }`
- `updateInvoice(id, data)` → `{ success: boolean, invoice: Invoice }`
- `deleteInvoice(id)` → `{ success: boolean }`
- `downloadCoverLetter(id)` — triggers file download
- `downloadInvoiceFile(id)` — triggers file download
- `uploadW9(personId, file)` → `{ success: boolean }`

For file uploads, use `FormData` (same pattern as `api/templates.ts`).

### Colors (`frontend/src/config/colors.ts`)

Add invoice status colors:
```typescript
export const INVOICE_STATUS_COLORS = {
  Unpaid:     { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
  'Needs W-9': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
  Approved:   { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  Paid:       { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
}
```

Add to `getStatusColor()` function so it handles invoice statuses too.

### Case Detail — Invoices Tab

Add a 7th tab to the case detail page (`frontend/src/pages/CaseDetail/`):

**New file: `InvoicesTab.tsx`**

Components:
1. **Drop zone** at the top — reuse the drag-and-drop pattern from `pages/Templates.tsx` (lines 396-453). Consider extracting a shared `<DropZone>` component into `frontend/src/components/common/DropZone.tsx` that both Templates and InvoicesTab can use. It accepts `onFileDrop`, `accept` (file types), and renders the drag UI.
2. **Extraction review modal** — after file upload + AI extraction, show a modal/form pre-filled with extracted data. User can edit fields, link to an existing person (payee), and confirm.
3. **Invoices table** — list all invoices for the case using TanStack Table (same pattern as tasks table):
   - Columns: Status (badge), Payee, Amount ($), Due Date, Received Date, Invoice #, Description, W-9 (icon), Actions
   - W-9 column: green checkmark if on file, red warning icon if missing
   - Row click → expand or open detail
   - Status toggle (dropdown or click-to-cycle)
   - Actions: download original file, generate cover letter, edit, delete
4. **Summary row** — total unpaid, total paid

**Person linking:** When the user confirms an extraction, show a dropdown to link to an existing person in the case (experts, mediators already assigned). If no match, allow creating the invoice with just the payee_name text, or adding a new person.

### W-9 Indicator

On the **Overview tab** person chips (or in person detail modals), add a small W-9 status indicator for roles that typically receive payments (experts, mediators). Could be a small icon/badge next to the person's name.

### Register the Tab

In `CaseDetail/index.tsx`, add the Invoices tab to the tab array. Keyboard shortcut: `7`. Update tab count references.

---

## Reuse Opportunities

### Shared DropZone Component

The drag-and-drop upload UI in `pages/Templates.tsx` (lines ~396-453) should be extracted into a reusable component:

```
frontend/src/components/common/DropZone.tsx
```

Props:
- `onFileDrop: (file: File) => void`
- `accept?: string` (e.g., ".pdf,.jpg,.png")
- `label?: string` (e.g., "Drop invoice here")
- `loading?: boolean`
- `file?: { name: string, size: number } | null` (show selected file)
- `onClear?: () => void`

Then refactor `Templates.tsx` to use this shared component too.

### DOCX Generation

The existing `services/docx_generator.py` already handles DOCX template filling. Reuse or extend it for cover letter generation rather than writing a new one.

### File Upload Pattern

The existing `routes/templates.py` upload handler shows the pattern for receiving multipart file uploads in FastAPI/Starlette. Reuse that pattern for invoice and W-9 uploads.

---

## Implementation Order

1. **File storage setup** — `services/storage.py`, `STORAGE_DIR` config, create directories
2. **Database** — Invoice model in `models.py`, Alembic migration, `db/invoices.py`
3. **Schemas** — InvoiceStatus literal, input/output models
4. **Routes** — `routes/invoices.py` (CRUD + upload + cover letter + file download)
5. **AI extraction** — `services/invoice_extractor.py`
6. **Cover letter template** — `templates/invoices/cover_letter.docx` + generation logic
7. **Frontend types + API** — `types/invoice.ts`, `api/invoices.ts`
8. **Frontend DropZone** — extract shared component from Templates.tsx
9. **Frontend InvoicesTab** — drop zone, extraction review modal, table, status badges
10. **W-9 tracking** — backend attribute updates, upload route, frontend indicators
11. **Colors** — `INVOICE_STATUS_COLORS` in `colors.ts`
12. **Dockerfile** — if any new root-level Python files/directories were created, add them to COPY lines
13. **Verify** — run `/verify` to check types, migrations, and build

---

## Files to Create

| File | Purpose |
|------|---------|
| `services/storage.py` | File storage helper (save, get, delete) |
| `services/invoice_extractor.py` | AI extraction via Claude Vision API |
| `db/invoices.py` | Invoice CRUD database operations |
| `routes/invoices.py` | Invoice REST API endpoints |
| `templates/invoices/cover_letter.docx` | Cover letter DOCX template |
| `frontend/src/types/invoice.ts` | TypeScript interfaces |
| `frontend/src/api/invoices.ts` | API client functions |
| `frontend/src/pages/CaseDetail/InvoicesTab.tsx` | Invoices tab component |
| `frontend/src/components/common/DropZone.tsx` | Shared drop zone component |

## Files to Modify

| File | Change |
|------|--------|
| `models.py` | Add Invoice model |
| `config.py` | Add STORAGE_DIR setting |
| `schemas/common.py` | Add InvoiceStatus literal |
| `schemas/inputs.py` | Add Create/UpdateInvoiceInput |
| `schemas/outputs.py` | Add InvoiceOut |
| `db/__init__.py` | Export invoice functions |
| `main.py` | Register invoice routes |
| `routes/persons.py` | Add W-9 upload/download endpoints |
| `frontend/src/pages/CaseDetail/index.tsx` | Add Invoices tab (tab 7) |
| `frontend/src/pages/Templates.tsx` | Refactor to use shared DropZone |
| `frontend/src/config/colors.ts` | Add INVOICE_STATUS_COLORS |
| `frontend/src/types/common.ts` | Add InvoiceStatus type |
| `Dockerfile` | Add any new root-level files to COPY lines |
| `.env.example` | Add STORAGE_DIR |

---

## Edge Cases & Notes

- **Large files**: Consider a max file size (e.g., 20MB) — reject larger uploads early
- **File types**: Accept `.pdf`, `.jpg`, `.jpeg`, `.png` — reject others
- **AI extraction failures**: If Claude can't extract data, still save the file but return empty fields for the user to fill manually. Show a note that extraction failed.
- **Duplicate invoices**: Consider warning if an invoice with the same number + payee already exists for the case
- **Cover letter without check number**: If the user generates a cover letter before entering a check number, either prompt them or leave that field blank in the template
- **Person linking**: When a payee_name is extracted, attempt fuzzy matching against existing persons on the case to suggest a link
- **W-9 auto-flag**: When creating an invoice linked to a person without a W-9, automatically set status to "Needs W-9" instead of "Unpaid"
- **Paid status**: When marking as "Paid", prompt for check_number and paid_date
- **File deletion**: When deleting an invoice, also delete the stored file from disk
- **Hetzner setup**: The `/data/galipo` directory needs to be created on the server with appropriate permissions. If using Docker, mount it as a volume. Add to deployment docs.
