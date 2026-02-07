# Stale Schema References

Tracked issues from the unified roles migration (012/013) that still need fixing.

> **Status**: Partially fixed. `tools.py` docstring updated. `seed_dev_data.py` rewritten to use new roles API.
> `db/import_case.py` `_infer_role_category()` still returns invalid categories — open issue.

## seed_dev_data.py — FIXED

Rewritten to use the new roles API:
- `create_person()` no longer passes `person_type=` or `attributes=`
- `assign_person_to_case()` uses `role_id` (int) from `role_map` built via `db.get_roles()`
- Judges created via `db.create_judge()` (standalone table) instead of `db.create_person()`
- Role-specific attributes (bar_number, hourly_rate, expertises) passed on assignments, not persons
- Summary line uses `db.get_roles()` instead of deleted `db.get_person_types()`

## db/import_case.py

**`_infer_role_category()` returns invalid categories** (lines ~305-316):

```python
# Returns these (INVALID — will fail CHECK constraint):
"internal_team"   # should be "counsel"
"opposing_team"   # should be "counsel", "defendant", or "expert" depending on role
"third_party"     # should be "other"
```

Valid categories (from `db/validation.py` and the `chk_roles_category` CHECK constraint):
`client`, `counsel`, `defendant`, `expert`, `mediator`, `other`

## tools.py — import_case docstring

Lines ~223-228 list old role names and categories in the MCP tool documentation:
- References "Lead Attorney", "Co-Counsel", "Paralegal", "Case Manager" etc.
- Uses category labels "Internal team", "Opposing team", "Third party"
- Should reference the actual roles from the `roles` table (snake_case names, 6 categories)
