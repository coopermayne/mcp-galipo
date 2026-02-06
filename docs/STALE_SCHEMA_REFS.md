# Stale Schema References

Tracked issues from the unified roles migration (012/013) that still need fixing.

## seed_dev_data.py

**Will crash on run.** Three categories of problems:

1. **`create_person()` calls pass `person_type=`** (lines ~79-217) — this parameter was removed in the unified roles migration. The function signature is now `create_person(name, phones, emails, address, organization, notes)`.

2. **`assign_person_to_case()` calls pass role name strings instead of `role_id` ints** (lines ~356-376):
   ```python
   # Current (broken):
   db.assign_person_to_case(case_id, client_id, "Client", side="plaintiff")

   # Should be:
   role = db.get_role_by_name("plaintiff")
   db.assign_person_to_case(case_id, client_id, role["id"], is_primary=True)
   ```
   Also passes `side=` which no longer exists in the function signature.

3. **Calls `db.get_person_types()`** (line ~846) — function no longer exists.

**Role name mapping** (old name -> new name in roles table):
| Old | New |
|-----|-----|
| "Client" | `plaintiff` |
| "Defendant" | `individual_defendant` or `municipality_defendant` |
| "Opposing Counsel" / "Defense Counsel" | `opposing_counsel` |
| "Plaintiff Expert" | `plaintiff_expert` |
| "Defense Expert" | `defense_expert` |
| "Mediator" | `mediator` |
| "Witness" | `witness` |

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
