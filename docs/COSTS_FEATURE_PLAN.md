# Case Costs Tracking Feature — Implementation Plan

## Context

The firm currently tracks case costs in an Excel spreadsheet (`Costs-Template.xlsx`) with 4 sheets:

1. **Galipo Office Costs** — our firm's line-item costs by category
2. **Co-Counsel Costs** — co-counsel's line-item costs (identical structure)
3. **Payments Between Offices** — reconciliation ledger for inter-office checks
4. **Disbursement** — settlement breakdown (deferred — overlaps existing `CaseFinancial`/`CaseCounselFee`)

This feature digitizes sheets 1-3 into the app with both manual entry and AI-powered invoice upload. Files stored on the Hetzner server (no 3rd party needed).

### Spreadsheet Structure (for reference)

Each cost entry has these columns:
| Column | Description |
|--------|-------------|
| Date | When the cost was incurred |
| Category | One of 10 categories (see below) |
| Paid To | Vendor / recipient |
| Check # | Payment reference |
| Cost / Expense | Description of the cost |
| Amount ($) | Dollar amount |

**10 Cost Categories:** Court Costs, Mediation, Experts, Messenger / Process, Court Reporters, Postage, Copy / Print / Scan, Parking, Travel, Miscellaneous

The spreadsheet groups rows by category with section subtotals and a grand total. Sheets 1 and 2 are identical in structure but track different firms' costs.

Sheet 3 (Payments Between Offices) tracks:
- Agreed cost-share percentage (e.g., 50/50)
- Reconciliation checks sent between firms (date, description, amount each direction, check #, notes)
- Net contribution per firm and total case spend

---

## Phase 1: Database Models + Migration

### New Models in `models.py`

#### `CaseCost` — individual cost line items

Replaces spreadsheet rows from sheets 1 & 2. One table with a `source` field to distinguish our firm vs co-counsel.

```python
class CaseCost(Base):
    __tablename__ = "case_costs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id"], ["cases.id"], ondelete="CASCADE",
            name="case_costs_case_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="case_costs_pkey"),
        Index("idx_case_costs_case_id", "case_id"),
        Index("idx_case_costs_source", "source"),
        Index("idx_case_costs_category", "category"),
        Index("idx_case_costs_date", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(20))          # 'our_firm' | 'co_counsel'
    category: Mapped[str] = mapped_column(String(50))         # one of 10 categories
    date: Mapped[Optional[date]] = mapped_column(Date)        # nullable (co-counsel may lack exact date)
    paid_to: Mapped[Optional[str]] = mapped_column(String(255))
    check_number: Mapped[Optional[str]] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    file_path: Mapped[Optional[str]] = mapped_column(Text)    # relative path under MEDIA_DIR
    file_name: Mapped[Optional[str]] = mapped_column(String(255))  # original filename
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    case: Mapped[Case] = relationship(back_populates="costs")
```

#### `CaseOfficePayment` — reconciliation payments between firms

```python
class CaseOfficePayment(Base):
    __tablename__ = "case_office_payments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id"], ["cases.id"], ondelete="CASCADE",
            name="case_office_payments_case_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="case_office_payments_pkey"),
        Index("idx_case_office_payments_case_id", "case_id"),
        Index("idx_case_office_payments_date", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(Integer)
    date: Mapped[date] = mapped_column(Date)
    description: Mapped[Optional[str]] = mapped_column(Text)
    we_sent: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))     # amount we sent to co-counsel
    they_sent: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))   # amount they sent to us
    check_number: Mapped[Optional[str]] = mapped_column(String(50))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    case: Mapped[Case] = relationship(back_populates="office_payments")
```

#### New column on `CaseFinancial`

```python
cost_share_percentage: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))  # our agreed share, e.g. 50.00
```

#### New relationships on `Case`

```python
costs: Mapped[list[CaseCost]] = relationship(back_populates="case")
office_payments: Mapped[list[CaseOfficePayment]] = relationship(back_populates="case")
```

### Migration

```bash
set -a && source .env && set +a
alembic revision --autogenerate -m "add case costs and office payments tables"
# Review generated migration
alembic upgrade head
```

---

## Phase 2: Backend — DB Layer

### New file: `db/costs.py`

CRUD functions following existing patterns in `db/tasks.py`:

```python
# Cost entries
def list_costs(case_id: int, source: str = None, category: str = None) -> list[dict]
def get_cost(cost_id: int) -> dict | None
def add_cost(case_id: int, source: str, category: str, amount: float, **kwargs) -> dict
def update_cost(cost_id: int, **fields) -> dict | None
def delete_cost(cost_id: int) -> bool

# Summary/aggregation
def get_cost_summary(case_id: int) -> dict
    # Returns: {
    #   grand_total, our_firm_total, co_counsel_total,
    #   by_category: {category: {our_firm: X, co_counsel: Y, total: Z}},
    #   cost_count
    # }

# Office payments
def list_office_payments(case_id: int) -> list[dict]
def add_office_payment(case_id: int, date: str, **kwargs) -> dict
def update_office_payment(payment_id: int, **fields) -> dict | None
def delete_office_payment(payment_id: int) -> bool
```

### Modify: `db/__init__.py`

Add imports for all new functions from `db/costs.py`.

---

## Phase 3: Backend — Routes

### New file: `routes/costs.py`

REST API endpoints following `routes/financials.py` pattern:

```
# Cost entries
GET    /api/v1/costs?case_id=X&source=&category=     List costs (filterable)
GET    /api/v1/costs/:id                               Get single cost
POST   /api/v1/costs                                   Create cost (JSON body)
PUT    /api/v1/costs/:id                               Update cost
DELETE /api/v1/costs/:id                               Delete cost
GET    /api/v1/costs/summary?case_id=X                 Totals by source/category

# File upload + AI extraction
POST   /api/v1/costs/upload                            Upload invoice (multipart/form-data)
POST   /api/v1/costs/extract                           AI extract from uploaded file
GET    /api/v1/costs/files/:case_id/:filename           Serve uploaded invoice file

# Office payments
GET    /api/v1/office-payments?case_id=X               List office payments
POST   /api/v1/office-payments                         Create payment
PUT    /api/v1/office-payments/:id                     Update payment
DELETE /api/v1/office-payments/:id                     Delete payment
```

#### File upload flow (`POST /api/v1/costs/upload`)

```python
# 1. Accept multipart form with file + case_id
# 2. Validate file type (PDF, PNG, JPG, JPEG)
# 3. Save to MEDIA_DIR/costs/{case_id}/{uuid}{ext}
# 4. Return {file_path, file_name, content_type}
```

Uses UUID-based naming (same pattern as `routes/sms.py` media handling).

#### AI extraction flow (`POST /api/v1/costs/extract`)

```python
# 1. Accept {file_path, case_id} (file already uploaded)
# 2. Read file from MEDIA_DIR
# 3. Call cost_extractor service
# 4. Return extracted fields for frontend confirmation
```

### Modify: `routes/__init__.py`

Add `from .costs import register_cost_routes` and call `register_cost_routes(mcp)` in `register_routes()`.

---

## Phase 4: Backend — Invoice Extraction Service

### New file: `services/cost_extractor.py`

Follows `services/case_extractor.py` pattern exactly:

```python
EXTRACT_INVOICE_TOOL = {
    "name": "submit_invoice_info",
    "description": "Submit extracted invoice information.",
    "input_schema": {
        "type": "object",
        "properties": {
            "vendor": {"type": "string", "description": "Company or person the invoice is from"},
            "amount": {"type": "number", "description": "Total amount due"},
            "date": {"type": "string", "description": "Invoice date (YYYY-MM-DD)"},
            "invoice_number": {"type": "string", "description": "Invoice or reference number"},
            "check_number": {"type": "string", "description": "Check number if visible"},
            "description": {"type": "string", "description": "Brief description of services/costs"},
            "category": {
                "type": "string",
                "enum": ["Court Costs", "Mediation", "Experts", "Messenger / Process",
                         "Court Reporters", "Postage", "Copy / Print / Scan",
                         "Parking", "Travel", "Miscellaneous"],
                "description": "Best-fit category for this cost"
            },
            "line_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "amount": {"type": "number"}
                    }
                },
                "description": "Individual line items if the invoice has multiple charges"
            }
        },
        "required": ["vendor", "amount"]
    }
}
```

**For PDFs:** Extract text via `pdfplumber` or similar, send text to Claude with tool.
**For images:** Send as base64 image content block to Claude (vision) with tool.

Uses `settings.extraction_model` (claude-haiku).

---

## Phase 5: Frontend — Service Layer + Types

### New file: `frontend/src/services/costs.ts`

API client functions following `services/financials.ts` pattern:

```typescript
// Cost entries
export async function listCosts(caseId: number, filters?: CostFilters): Promise<CaseCost[]>
export async function getCost(id: number): Promise<CaseCost>
export async function createCost(data: CreateCostData): Promise<CaseCost>
export async function updateCost(id: number, data: UpdateCostData): Promise<CaseCost>
export async function deleteCost(id: number): Promise<void>
export async function getCostSummary(caseId: number): Promise<CostSummary>

// File upload + extraction
export async function uploadInvoice(caseId: number, file: File): Promise<UploadResult>
export async function extractInvoice(caseId: number, filePath: string): Promise<ExtractedInvoice>

// Office payments
export async function listOfficePayments(caseId: number): Promise<CaseOfficePayment[]>
export async function createOfficePayment(data: CreatePaymentData): Promise<CaseOfficePayment>
export async function updateOfficePayment(id: number, data: UpdatePaymentData): Promise<CaseOfficePayment>
export async function deleteOfficePayment(id: number): Promise<void>
```

### TypeScript types (in `services/costs.ts` or `types/`)

```typescript
type CostSource = 'our_firm' | 'co_counsel'
type CostCategory = 'Court Costs' | 'Mediation' | 'Experts' | 'Messenger / Process' |
  'Court Reporters' | 'Postage' | 'Copy / Print / Scan' | 'Parking' | 'Travel' | 'Miscellaneous'

interface CaseCost {
  id: number
  case_id: number
  source: CostSource
  category: CostCategory
  date: string | null
  paid_to: string | null
  check_number: string | null
  description: string | null
  amount: string
  file_path: string | null
  file_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface CaseOfficePayment {
  id: number
  case_id: number
  date: string
  description: string | null
  we_sent: string | null
  they_sent: string | null
  check_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface CostSummary {
  grand_total: string
  our_firm_total: string
  co_counsel_total: string
  by_category: Record<CostCategory, { our_firm: string; co_counsel: string; total: string }>
  cost_count: number
}

interface ExtractedInvoice {
  vendor: string | null
  amount: number | null
  date: string | null
  invoice_number: string | null
  check_number: string | null
  description: string | null
  category: CostCategory | null
  line_items: Array<{ description: string; amount: number }>
}
```

---

## Phase 6: Frontend — Costs Page

### Route

Add to `frontend/src/main.tsx`:
```typescript
{ path: "cases/:id/costs", lazy: lazy(() => import("@/pages/cases/costs")) }
```

### File structure

```
frontend/src/pages/cases/costs/
  index.tsx                          Main page component
  components/
    costs-summary.tsx                Top summary cards (Grand Total, Our Costs, Co-Counsel, Net)
    costs-table.tsx                  TanStack Table for cost line items, grouped by category
    cost-columns.tsx                 Column definitions for cost table
    add-cost-dialog.tsx              Manual entry form dialog
    invoice-dropzone.tsx             Drag-and-drop upload zone
    invoice-confirm-dialog.tsx       AI extraction confirmation (editable form)
    office-payments-table.tsx        Inter-office payments table
    payment-columns.tsx              Column definitions for payment table
    add-payment-dialog.tsx           Manual payment entry form
```

### Page layout (`index.tsx`)

```
+----------------------------------------------------------+
| ← Back to Case    |  Case Name — Costs                   |
+----------------------------------------------------------+
| [Grand Total]  [Our Firm]  [Co-Counsel]  [Net Contrib.]  |
+----------------------------------------------------------+
| [Our Costs]  [Co-Counsel Costs]  [Payments Between]      |  ← Tabs
+----------------------------------------------------------+
|                                                           |
|  +-- Invoice Dropzone (drag PDF/image here) -----------+ |
|  |  📄 Drop an invoice here to auto-extract cost info  | |
|  +----------------------------------------------------+  |
|                                              [+ Add Cost] |
|                                                           |
|  COURT COSTS                               Subtotal: $X  |
|  +-------------------------------------------------+     |
|  | Date | Paid To | Check# | Description | Amount  |     |
|  | ...  | ...     | ...    | ...         | $X.XX   |     |
|  +-------------------------------------------------+     |
|                                                           |
|  MEDIATION                                 Subtotal: $X  |
|  +-------------------------------------------------+     |
|  | ...                                              |     |
|  +-------------------------------------------------+     |
|                                                           |
|  (... more categories ...)                                |
+----------------------------------------------------------+
```

### Invoice upload UX flow

1. User drags PDF/image into dropzone (or clicks to browse)
2. File uploads immediately via `POST /api/v1/costs/upload` → progress indicator
3. AI extraction runs via `POST /api/v1/costs/extract` → loading state ("Analyzing invoice...")
4. `InvoiceConfirmDialog` appears with pre-filled editable fields:
   - Source (Our Firm / Co-Counsel) — dropdown
   - Category — dropdown (AI-suggested, user can change)
   - Paid To — text input (AI-extracted)
   - Amount — currency input (AI-extracted)
   - Date — date picker (AI-extracted)
   - Check # — text input (if found)
   - Description — text area (AI-extracted)
   - [ ] Create task for this cost — checkbox
5. User reviews/edits → clicks "Add Cost"
6. Cost entry created via `POST /api/v1/costs`, file linked
7. Table refreshes, new entry appears under correct category
8. If "create task" checked → task created: "Pay invoice — $X to [Vendor]" with due date

### Add Cost Dialog (manual entry)

Simple form with fields:
- Source: Our Firm / Co-Counsel (radio or toggle)
- Category: Dropdown of 10 categories
- Date: Date picker
- Paid To: Text input
- Check #: Text input
- Description: Text area
- Amount: Currency input
- Notes: Text area (optional)

### Payments Between Offices tab

```
+----------------------------------------------------------+
| Our agreed share of costs: [50%] (editable)               |
|                                                           |
| Our Net Contribution: $X  |  Their Net: $X  |  Total: $X |
+----------------------------------------------------------+
|                                              [+ Payment]  |
| +------------------------------------------------------+ |
| | Date | Description | We Sent→Them | They Sent→Us |Chk| |
| | ...  | ...         | $X           | —            |123| |
| +------------------------------------------------------+ |
|                     Subtotal:  $X sent      $X received   |
+----------------------------------------------------------+
```

### Link from case detail page

Modify `frontend/src/pages/cases/components/case-financials-card.tsx`:
- Add a "View Costs →" button that navigates to `/cases/:id/costs`
- Show a quick total of all costs on the card (query `GET /api/v1/costs/summary?case_id=X`)

---

## Phase 7: Pydantic Schemas

### `schemas/inputs.py` additions

```python
class CreateCostInput(BaseModel):
    case_id: int
    source: Literal['our_firm', 'co_counsel']
    category: Literal['Court Costs', 'Mediation', 'Experts', 'Messenger / Process',
                       'Court Reporters', 'Postage', 'Copy / Print / Scan',
                       'Parking', 'Travel', 'Miscellaneous']
    amount: Decimal
    date: Optional[date] = None
    paid_to: Optional[str] = None
    check_number: Optional[str] = None
    description: Optional[str] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    notes: Optional[str] = None

class UpdateCostInput(BaseModel):
    # All fields optional
    ...

class CreateOfficePaymentInput(BaseModel):
    case_id: int
    date: date
    description: Optional[str] = None
    we_sent: Optional[Decimal] = None
    they_sent: Optional[Decimal] = None
    check_number: Optional[str] = None
    notes: Optional[str] = None
```

### `schemas/outputs.py` additions

Output models matching the TypeScript types above.

---

## Summary of files

### Files to create
| File | Purpose |
|------|---------|
| `db/costs.py` | DB CRUD functions for costs and office payments |
| `routes/costs.py` | REST API endpoints |
| `services/cost_extractor.py` | AI invoice extraction via Claude |
| `frontend/src/services/costs.ts` | API client + TypeScript types |
| `frontend/src/pages/cases/costs/index.tsx` | Main costs page |
| `frontend/src/pages/cases/costs/components/costs-summary.tsx` | Summary cards |
| `frontend/src/pages/cases/costs/components/costs-table.tsx` | Cost line items table |
| `frontend/src/pages/cases/costs/components/cost-columns.tsx` | Table column definitions |
| `frontend/src/pages/cases/costs/components/add-cost-dialog.tsx` | Manual entry form |
| `frontend/src/pages/cases/costs/components/invoice-dropzone.tsx` | Drag-and-drop upload |
| `frontend/src/pages/cases/costs/components/invoice-confirm-dialog.tsx` | AI extraction confirmation |
| `frontend/src/pages/cases/costs/components/office-payments-table.tsx` | Payments table |
| `frontend/src/pages/cases/costs/components/payment-columns.tsx` | Payment column definitions |
| `frontend/src/pages/cases/costs/components/add-payment-dialog.tsx` | Payment entry form |
| `alembic/versions/XXXX_add_case_costs_and_office_payments.py` | Database migration |

### Files to modify
| File | Change |
|------|--------|
| `models.py` | Add `CaseCost`, `CaseOfficePayment`, column on `CaseFinancial`, relationships on `Case` |
| `schemas/inputs.py` | Add cost and payment input schemas |
| `schemas/outputs.py` | Add cost and payment output schemas |
| `db/__init__.py` | Export new functions |
| `routes/__init__.py` | Register cost routes |
| `frontend/src/main.tsx` | Add `/cases/:id/costs` route |
| `frontend/src/pages/cases/components/case-financials-card.tsx` | Add "View Costs" link + total display |

### Existing code to reuse
| File | What to reuse |
|------|---------------|
| `services/case_extractor.py` | Anthropic client pattern, tool_choice, tool schema structure |
| `routes/sms.py` (~lines 150-200) | File storage pattern (UUID naming, MEDIA_DIR, content type) |
| `routes/financials.py` | Route registration and structure pattern |
| `db/tasks.py` | CRUD function patterns |
| `frontend/src/pages/templates/components/toa-page.tsx` | Drag-and-drop upload UI |
| `frontend/src/pages/cases/components/case-financials-card.tsx` | Financial card UI patterns |
| `components/common/DataTableColumnHeader` | Sortable table headers |
| `components/common/DataTablePagination` | Table pagination |

---

## Verification checklist

1. Start dev servers with `/dev`
2. Navigate to a case detail page → verify "View Costs" link appears in financials card
3. Click through to `/cases/:id/costs` → verify empty state renders
4. Add a cost manually via form → verify it appears in table under correct category
5. Upload a PDF invoice → verify AI extraction → confirm → verify cost appears with file link
6. Upload an image invoice (photo of receipt) → verify same flow
7. Switch between Our Costs / Co-Counsel tabs → verify filtering works
8. Add an inter-office payment → verify it appears and net contribution updates
9. Verify summary cards show correct totals
10. Check file can be viewed/downloaded by clicking the attachment icon
11. Verify system comment created on case when cost is added
12. Test "create task" checkbox on invoice confirmation
