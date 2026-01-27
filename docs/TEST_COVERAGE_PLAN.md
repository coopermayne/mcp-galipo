# Test Coverage Improvement Plan

> **Status:** Proposed
> **Created:** 2026-01-27
> **Current Coverage:** <10% estimated

## Executive Summary

The codebase has minimal test coverage. The backend (91 functions across 11 DB files, 13 route files, chat services) has **zero tests**. The frontend has only 1 Playwright test file for authentication. This plan prioritizes improvements by impact and effort.

---

## Current State

| Layer | Files/Functions | Coverage | Framework |
|-------|-----------------|----------|-----------|
| Backend DB | 11 files, 91 functions | 0% | None |
| Backend Routes | 13 files | 0% | None |
| Backend Services | Chat client, executor, tools | 0% | None |
| MCP Tools | `tools.py` + `tools/` | 0% | None |
| Frontend E2E | Auth only | ~5% | Playwright |
| Frontend Components | 30+ components | 0% | None |
| Browser Automation | Chat features | ~30% | Custom Playwright wrapper |

### Existing Test Infrastructure

**What exists:**
- `frontend/tests/auth.spec.ts` - 3 test cases for login flow
- `frontend/playwright.config.ts` - Playwright configuration
- `tests/browser/` - Custom browser automation for chat testing
  - `TestRunner.js` - Playwright wrapper with helpers
  - `PdfGenerator.js` - Test report generation
  - 4 scenario files for chat functionality

**What's missing:**
- No pytest in `requirements.txt`
- No pytest configuration (`pytest.ini`, `conftest.py`)
- No Vitest/Jest for frontend unit tests
- No test database fixtures
- No CI test pipeline

---

## Phase 1: Backend Foundation (Quick Wins)

**Goal:** Establish pytest infrastructure and test pure functions.

**Effort:** Small
**Impact:** High - enables all future backend testing

### 1.1 Add pytest infrastructure

```bash
# Add to requirements.txt
pytest==8.0.0
pytest-asyncio==0.23.0
pytest-cov==4.1.0
```

Create test structure:
```
tests/
├── __init__.py
├── conftest.py           # Shared fixtures
├── unit/
│   ├── __init__.py
│   └── test_validation.py
└── integration/
    └── __init__.py
```

### 1.2 Test `db/validation.py` (Easiest Win)

8 pure functions with no database dependencies:

| Function | Test Cases |
|----------|------------|
| `validate_case_status()` | Valid status, invalid status, case sensitivity |
| `validate_task_status()` | Valid status, invalid status |
| `validate_urgency()` | 1-4 valid, 0 invalid, 5 invalid, non-integer |
| `validate_date_format()` | YYYY-MM-DD valid, other formats invalid, None handling |
| `validate_time_format()` | HH:MM valid, other formats invalid, None handling |
| `validate_person_type()` | Non-empty valid, empty invalid, whitespace handling |
| `validate_person_side()` | plaintiff/defendant/neutral valid, other invalid |
| `validate_case_person_role()` | Judge roles blocked, other roles allowed |

**Example test file:**
```python
# tests/unit/test_validation.py
import pytest
from db.validation import (
    validate_case_status, validate_urgency, validate_date_format,
    ValidationError, CASE_STATUSES
)

class TestValidateCaseStatus:
    def test_valid_status(self):
        assert validate_case_status("Discovery") == "Discovery"

    def test_invalid_status_raises(self):
        with pytest.raises(ValidationError, match="Invalid case status"):
            validate_case_status("InvalidStatus")

    def test_all_valid_statuses(self):
        for status in CASE_STATUSES:
            assert validate_case_status(status) == status

class TestValidateUrgency:
    @pytest.mark.parametrize("urgency", [1, 2, 3, 4])
    def test_valid_urgency(self, urgency):
        assert validate_urgency(urgency) == urgency

    @pytest.mark.parametrize("urgency", [0, 5, -1, 100])
    def test_invalid_urgency_raises(self, urgency):
        with pytest.raises(ValidationError):
            validate_urgency(urgency)

class TestValidateDateFormat:
    def test_valid_date(self):
        assert validate_date_format("2024-01-15") == "2024-01-15"

    def test_none_returns_none(self):
        assert validate_date_format(None) is None

    @pytest.mark.parametrize("invalid", ["01-15-2024", "2024/01/15", "Jan 15, 2024"])
    def test_invalid_format_raises(self, invalid):
        with pytest.raises(ValidationError):
            validate_date_format(invalid)
```

### 1.3 Deliverables

- [ ] Add pytest dependencies to `requirements.txt`
- [ ] Create `tests/conftest.py` with basic fixtures
- [ ] Create `tests/unit/test_validation.py` with full coverage
- [ ] Add `pytest.ini` configuration
- [ ] Document test commands in README or CLAUDE.md

---

## Phase 2: Database Layer Tests

**Goal:** Test database operations with isolated test database.

**Effort:** Medium
**Impact:** High - DB layer is the foundation

### 2.1 Test database fixture

```python
# tests/conftest.py
import pytest
import os
from db.connection import get_cursor

@pytest.fixture(scope="session")
def test_db():
    """Use a separate test database or transaction rollback."""
    # Option A: Use test database
    os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql://localhost/galipo_test")

    # Option B: Use transactions that roll back
    # (implement transaction wrapper)
    yield
    # Cleanup

@pytest.fixture
def db_cursor(test_db):
    """Provide a cursor that rolls back after each test."""
    with get_cursor() as cur:
        yield cur
        # Rollback happens via context manager on error
```

### 2.2 Priority DB modules to test

| Module | Functions | Priority | Notes |
|--------|-----------|----------|-------|
| `db/cases.py` | 10 | High | Core entity, most used |
| `db/tasks.py` | 9 | High | Complex ordering logic |
| `db/events.py` | 8 | High | Date/time handling |
| `db/persons.py` | 10 | Medium | JSONB attributes |
| `db/proceedings.py` | 9 | Medium | Judge associations |
| `db/notes.py` | 4 | Low | Simple CRUD |
| `db/activities.py` | 5 | Low | Simple CRUD |

### 2.3 Example: Task ordering tests

```python
# tests/unit/test_tasks_db.py
class TestTaskReordering:
    def test_reorder_task_moves_up(self, db_cursor):
        # Create case and tasks
        case_id = create_test_case(db_cursor)
        task1 = create_task(case_id, "Task 1", order_index=0)
        task2 = create_task(case_id, "Task 2", order_index=1)
        task3 = create_task(case_id, "Task 3", order_index=2)

        # Move task3 to position 0
        reorder_task(task3["id"], 0)

        # Verify new order
        tasks = get_tasks_for_case(case_id)
        assert tasks[0]["id"] == task3["id"]
        assert tasks[1]["id"] == task1["id"]
        assert tasks[2]["id"] == task2["id"]
```

### 2.4 Deliverables

- [ ] Create test database setup script
- [ ] Add `tests/unit/test_cases_db.py`
- [ ] Add `tests/unit/test_tasks_db.py`
- [ ] Add `tests/unit/test_events_db.py`
- [ ] Add `tests/unit/test_persons_db.py`

---

## Phase 3: API Route Tests

**Goal:** Test REST endpoints with FastAPI TestClient.

**Effort:** Medium
**Impact:** High - ensures API contracts work

### 3.1 TestClient setup

```python
# tests/conftest.py
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    """Provide authenticated test client."""
    with TestClient(app) as client:
        # Authenticate
        client.post("/api/v1/auth/login", json={
            "username": "test",
            "password": "test"
        })
        yield client
```

### 3.2 Priority routes to test

| Route File | Endpoints | Priority |
|------------|-----------|----------|
| `routes/cases.py` | GET/POST/PUT/DELETE cases | High |
| `routes/tasks.py` | CRUD + reorder | High |
| `routes/events.py` | CRUD + date queries | High |
| `routes/auth.py` | Login/logout/session | High |
| `routes/persons.py` | CRUD + associations | Medium |
| `routes/export.py` | JSON export | Medium |
| `routes/chat.py` | SSE streaming | Low (complex) |

### 3.3 Example: Cases API tests

```python
# tests/integration/test_cases_api.py
class TestCasesAPI:
    def test_list_cases(self, client):
        response = client.get("/api/v1/cases")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_case(self, client):
        response = client.post("/api/v1/cases", json={
            "name": "Test v. Case",
            "status": "Discovery"
        })
        assert response.status_code == 201
        assert response.json()["name"] == "Test v. Case"

    def test_create_case_invalid_status(self, client):
        response = client.post("/api/v1/cases", json={
            "name": "Test v. Case",
            "status": "InvalidStatus"
        })
        assert response.status_code == 400

    def test_get_case_not_found(self, client):
        response = client.get("/api/v1/cases/99999")
        assert response.status_code == 404
```

### 3.4 Deliverables

- [ ] Add `tests/integration/test_cases_api.py`
- [ ] Add `tests/integration/test_tasks_api.py`
- [ ] Add `tests/integration/test_events_api.py`
- [ ] Add `tests/integration/test_auth_api.py`
- [ ] Add `tests/integration/test_persons_api.py`

---

## Phase 4: MCP Tool Tests

**Goal:** Validate MCP tools return correct structures for AI consumption.

**Effort:** Medium
**Impact:** Medium-High - AI reliability depends on tool correctness

### 4.1 What to test

- Input validation (reject bad inputs gracefully)
- Return value structure (consistent schemas)
- Error handling (meaningful error messages)
- Database side effects (correct data created/modified)

### 4.2 Example: Task tool tests

```python
# tests/unit/test_mcp_tools.py
from tools import create_task, update_task, list_tasks

class TestCreateTaskTool:
    def test_creates_task_with_required_fields(self, test_db):
        result = create_task(
            case_id=1,
            title="Research case law",
            urgency=2
        )
        assert "id" in result
        assert result["title"] == "Research case law"
        assert result["urgency"] == 2
        assert result["status"] == "Pending"  # default

    def test_invalid_urgency_returns_error(self, test_db):
        result = create_task(case_id=1, title="Test", urgency=10)
        assert "error" in result

    def test_missing_case_returns_error(self, test_db):
        result = create_task(case_id=99999, title="Test", urgency=1)
        assert "error" in result
```

### 4.3 Deliverables

- [ ] Add `tests/unit/test_tools_cases.py`
- [ ] Add `tests/unit/test_tools_tasks.py`
- [ ] Add `tests/unit/test_tools_events.py`
- [ ] Add `tests/unit/test_tools_persons.py`

---

## Phase 5: Frontend Component Tests

**Goal:** Unit test React components with Vitest.

**Effort:** Medium
**Impact:** Medium - catches UI bugs early

### 5.1 Setup Vitest

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

### 5.2 Priority components to test

| Component | Why | Complexity |
|-----------|-----|------------|
| `TaskList.tsx` | Drag-drop logic | High |
| `CaseCard.tsx` | Renders case data | Low |
| `EventForm.tsx` | Date/time validation | Medium |
| `PersonSelect.tsx` | Autocomplete logic | Medium |
| Form components | Input validation | Low-Medium |

### 5.3 Example: TaskList test

```typescript
// frontend/src/__tests__/TaskList.test.tsx
import { render, screen } from '@testing-library/react'
import { TaskList } from '../components/tasks/TaskList'

describe('TaskList', () => {
  const mockTasks = [
    { id: 1, title: 'Task 1', status: 'Pending', urgency: 2 },
    { id: 2, title: 'Task 2', status: 'Active', urgency: 3 },
  ]

  it('renders all tasks', () => {
    render(<TaskList tasks={mockTasks} />)
    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
  })

  it('shows empty state when no tasks', () => {
    render(<TaskList tasks={[]} />)
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
  })
})
```

### 5.4 Deliverables

- [ ] Add Vitest and testing-library to frontend
- [ ] Create `frontend/vitest.config.ts`
- [ ] Create `frontend/src/test/setup.ts`
- [ ] Add `frontend/src/__tests__/TaskList.test.tsx`
- [ ] Add `frontend/src/__tests__/CaseCard.test.tsx`
- [ ] Add `frontend/src/__tests__/EventForm.test.tsx`

---

## Phase 6: Expand E2E Tests

**Goal:** Cover critical user flows with Playwright.

**Effort:** Medium
**Impact:** High - catches integration issues

### 6.1 Priority flows to test

| Flow | Current | Target |
|------|---------|--------|
| Authentication | 3 tests | Keep |
| Case CRUD | 0 tests | Add |
| Task management | 0 tests | Add |
| Calendar/events | 0 tests | Add |
| Person management | 0 tests | Add |
| Data export | 0 tests | Add |

### 6.2 Example: Case management E2E

```typescript
// frontend/tests/cases.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Case Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('can create a new case', async ({ page }) => {
    await page.goto('/cases')
    await page.click('text=New Case')
    await page.fill('[name="name"]', 'Test v. Defendant')
    await page.selectOption('[name="status"]', 'Discovery')
    await page.click('text=Save')

    await expect(page.locator('text=Test v. Defendant')).toBeVisible()
  })

  test('can edit case status', async ({ page }) => {
    await page.goto('/cases/1')
    await page.selectOption('[name="status"]', 'Pre-trial')

    await expect(page.locator('[name="status"]')).toHaveValue('Pre-trial')
  })
})
```

### 6.3 Deliverables

- [ ] Add `frontend/tests/cases.spec.ts`
- [ ] Add `frontend/tests/tasks.spec.ts`
- [ ] Add `frontend/tests/events.spec.ts`
- [ ] Add `frontend/tests/persons.spec.ts`
- [ ] Add `frontend/tests/export.spec.ts`

---

## Phase 7: CI/CD Integration

**Goal:** Run tests automatically on every push.

**Effort:** Small
**Impact:** High - prevents regressions

### 7.1 GitHub Actions workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: galipo_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pytest --cov=. --cov-report=xml
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/galipo_test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run type-check
      - run: cd frontend && npm run test

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd frontend && npm ci
      - run: npx playwright install --with-deps
      - run: cd frontend && npm run test
```

### 7.2 Deliverables

- [ ] Create `.github/workflows/test.yml`
- [ ] Add test database setup script for CI
- [ ] Configure coverage reporting (Codecov or similar)

---

## Summary: Implementation Order

| Phase | Effort | Impact | Dependencies |
|-------|--------|--------|--------------|
| **1. Backend Foundation** | Small | High | None |
| **2. Database Tests** | Medium | High | Phase 1 |
| **3. API Route Tests** | Medium | High | Phase 1 |
| **4. MCP Tool Tests** | Medium | Medium-High | Phase 2 |
| **5. Frontend Components** | Medium | Medium | None |
| **6. E2E Expansion** | Medium | High | None |
| **7. CI/CD** | Small | High | Phases 1-6 |

**Recommended start:** Phase 1 (pytest setup + validation tests) can be done in a few hours and immediately provides value.

---

## Test Commands Reference

After implementation, these commands should work:

```bash
# Backend
pytest                          # Run all backend tests
pytest tests/unit/              # Unit tests only
pytest tests/integration/       # Integration tests only
pytest --cov=db --cov-report=html  # Coverage report

# Frontend
cd frontend
npm run test                    # Vitest unit tests
npm run test:e2e                # Playwright E2E
npm run test:ui                 # Playwright UI mode
npm run test:coverage           # Coverage report
```
