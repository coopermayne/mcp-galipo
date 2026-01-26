"""
SQL operations module for MCP tools.

Provides query execution, validated mutations with logging, and rollback capabilities.
"""

import re
import json
from typing import Any, Optional
from uuid import UUID

from .connection import get_cursor, serialize_row, serialize_rows
from .validation import (
    CASE_STATUSES,
    TASK_STATUSES,
    ACTIVITY_TYPES,
    PERSON_SIDES,
    ValidationError,
)

# Tables allowed for mutations via the MCP tools
ALLOWED_TABLES = {
    'cases', 'tasks', 'events', 'notes', 'activities',
    'persons', 'case_persons', 'jurisdictions', 'proceedings', 'judges',
    'person_types', 'expertise_types'
}

# Fields that have enum constraints
ENUM_FIELDS = {
    ('cases', 'status'): CASE_STATUSES,
    ('tasks', 'status'): TASK_STATUSES,
    ('tasks', 'urgency'): [1, 2, 3, 4],
    ('activities', 'type'): ACTIVITY_TYPES,
    ('case_persons', 'side'): PERSON_SIDES,
}

# Query timeout in seconds
QUERY_TIMEOUT_SECONDS = 5


def execute_query(sql: str, limit: int = 100) -> dict:
    """Execute a read-only SQL query.

    Args:
        sql: The SQL query to execute (SELECT only)
        limit: Maximum rows to return (default 100)

    Returns:
        Dict with 'rows', 'row_count', and 'columns' keys

    Raises:
        ValidationError: If query is not SELECT or contains dangerous patterns
    """
    # Normalize whitespace and check it's a SELECT
    normalized = ' '.join(sql.split()).strip().upper()

    if not normalized.startswith('SELECT'):
        raise ValidationError("Only SELECT queries are allowed. Use mutate() for INSERT/UPDATE/DELETE.")

    # Check for dangerous patterns
    dangerous_patterns = [
        r'\bDROP\b', r'\bTRUNCATE\b', r'\bALTER\b', r'\bCREATE\b',
        r'\bINSERT\b', r'\bUPDATE\b', r'\bDELETE\b', r'\bGRANT\b', r'\bREVOKE\b'
    ]
    for pattern in dangerous_patterns:
        if re.search(pattern, normalized):
            raise ValidationError(f"Query contains disallowed keyword matching: {pattern}")

    # Add LIMIT if not present
    if 'LIMIT' not in normalized:
        sql = f"{sql.rstrip().rstrip(';')} LIMIT {limit}"

    with get_cursor() as cur:
        # Set statement timeout
        cur.execute(f"SET statement_timeout = '{QUERY_TIMEOUT_SECONDS * 1000}'")

        try:
            cur.execute(sql)
            rows = cur.fetchall()

            # Get column names
            columns = [desc[0] for desc in cur.description] if cur.description else []

            return {
                'rows': serialize_rows([dict(row) for row in rows]),
                'row_count': len(rows),
                'columns': columns
            }
        finally:
            # Reset timeout
            cur.execute("SET statement_timeout = 0")


def _validate_mutation_data(table: str, data: dict) -> None:
    """Validate mutation data against known constraints.

    Args:
        table: The table being mutated
        data: The data being inserted/updated

    Raises:
        ValidationError: If data fails validation
    """
    for field, value in data.items():
        key = (table, field)
        if key in ENUM_FIELDS:
            valid_values = ENUM_FIELDS[key]
            if value not in valid_values:
                raise ValidationError(
                    f"Invalid {field} value '{value}' for {table}. "
                    f"Valid values: {', '.join(str(v) for v in valid_values)}"
                )


def _get_next_sequence(cur, session_id: UUID) -> int:
    """Get the next sequence number for a session's operations."""
    cur.execute(
        "SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM operation_log WHERE session_id = %s",
        (str(session_id),)
    )
    return cur.fetchone()['next_seq']


def _log_operation(
    cur,
    session_id: UUID,
    sequence: int,
    table_name: str,
    operation: str,
    record_id: Optional[int],
    before_data: Optional[dict],
    after_data: Optional[dict]
) -> None:
    """Log an operation to the operation_log table."""
    # Serialize datetime/date/time objects to strings for JSON storage
    before_json = json.dumps(serialize_row(before_data)) if before_data else None
    after_json = json.dumps(serialize_row(after_data)) if after_data else None

    cur.execute("""
        INSERT INTO operation_log (session_id, sequence, table_name, operation, record_id, before_data, after_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        str(session_id),
        sequence,
        table_name,
        operation,
        record_id,
        before_json,
        after_json
    ))


def execute_mutation(
    table: str,
    action: str,
    data: dict,
    where: Optional[dict],
    session_id: UUID
) -> dict:
    """Execute a validated mutation with logging.

    Args:
        table: Table name to mutate
        action: 'insert', 'update', or 'delete'
        data: Field values for insert/update (ignored for delete)
        where: Conditions for update/delete (required for those actions)
        session_id: UUID for the current chat session (for operation log)

    Returns:
        Dict with 'success', 'action', 'record_id', and affected record data

    Raises:
        ValidationError: If validation fails
    """
    action = action.lower()

    # Validate table name
    if table not in ALLOWED_TABLES:
        raise ValidationError(
            f"Table '{table}' is not allowed. "
            f"Allowed tables: {', '.join(sorted(ALLOWED_TABLES))}"
        )

    # Validate action
    if action not in ('insert', 'update', 'delete'):
        raise ValidationError(
            f"Invalid action '{action}'. Must be 'insert', 'update', or 'delete'."
        )

    # Require where clause for update/delete
    if action in ('update', 'delete') and not where:
        raise ValidationError(
            f"WHERE clause required for {action}. "
            "Specify which record(s) to modify."
        )

    # Validate data against known constraints
    if action in ('insert', 'update') and data:
        _validate_mutation_data(table, data)

    with get_cursor() as cur:
        sequence = _get_next_sequence(cur, session_id)

        if action == 'insert':
            return _execute_insert(cur, table, data, session_id, sequence)
        elif action == 'update':
            return _execute_update(cur, table, data, where, session_id, sequence)
        else:  # delete
            return _execute_delete(cur, table, where, session_id, sequence)


def _execute_insert(cur, table: str, data: dict, session_id: UUID, sequence: int) -> dict:
    """Execute an INSERT operation."""
    if not data:
        raise ValidationError("Data required for insert.")

    columns = list(data.keys())
    values = list(data.values())
    placeholders = ', '.join(['%s'] * len(values))
    col_names = ', '.join(columns)

    # Execute insert with RETURNING to get the new record
    sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) RETURNING *"
    cur.execute(sql, values)
    new_row = dict(cur.fetchone())

    # Log the operation
    _log_operation(
        cur, session_id, sequence, table, 'INSERT',
        new_row.get('id'), None, new_row
    )

    return {
        'success': True,
        'action': 'insert',
        'record_id': new_row.get('id'),
        'record': serialize_row(new_row)
    }


def _execute_update(cur, table: str, data: dict, where: dict, session_id: UUID, sequence: int) -> dict:
    """Execute an UPDATE operation."""
    if not data:
        raise ValidationError("Data required for update.")

    # First, get the current record(s) for before_data logging
    where_clauses = ' AND '.join([f"{k} = %s" for k in where.keys()])
    where_values = list(where.values())

    cur.execute(f"SELECT * FROM {table} WHERE {where_clauses}", where_values)
    before_rows = [dict(row) for row in cur.fetchall()]

    if not before_rows:
        return {
            'success': False,
            'action': 'update',
            'error': 'No matching records found'
        }

    # Build and execute update
    set_clauses = ', '.join([f"{k} = %s" for k in data.keys()])
    set_values = list(data.values())

    sql = f"UPDATE {table} SET {set_clauses} WHERE {where_clauses} RETURNING *"
    cur.execute(sql, set_values + where_values)
    after_rows = [dict(row) for row in cur.fetchall()]

    # Log each updated row
    for before_row, after_row in zip(before_rows, after_rows):
        _log_operation(
            cur, session_id, sequence, table, 'UPDATE',
            before_row.get('id'), before_row, after_row
        )
        sequence += 1  # Increment for each row

    return {
        'success': True,
        'action': 'update',
        'records_updated': len(after_rows),
        'records': serialize_rows(after_rows)
    }


def _execute_delete(cur, table: str, where: dict, session_id: UUID, sequence: int) -> dict:
    """Execute a DELETE operation."""
    # First, get the records we're about to delete
    where_clauses = ' AND '.join([f"{k} = %s" for k in where.keys()])
    where_values = list(where.values())

    cur.execute(f"SELECT * FROM {table} WHERE {where_clauses}", where_values)
    before_rows = [dict(row) for row in cur.fetchall()]

    if not before_rows:
        return {
            'success': False,
            'action': 'delete',
            'error': 'No matching records found'
        }

    # Log each row before deleting
    for before_row in before_rows:
        _log_operation(
            cur, session_id, sequence, table, 'DELETE',
            before_row.get('id'), before_row, None
        )
        sequence += 1

    # Execute delete
    cur.execute(f"DELETE FROM {table} WHERE {where_clauses}", where_values)

    return {
        'success': True,
        'action': 'delete',
        'records_deleted': len(before_rows)
    }


def rollback_operations(session_id: UUID, steps: int = 1) -> dict:
    """Rollback the last N operations for a session.

    Args:
        session_id: UUID of the chat session
        steps: Number of operations to rollback (default 1)

    Returns:
        Dict with 'success', 'rolled_back' count, and list of undone operations
    """
    with get_cursor() as cur:
        # Get the last N operations that haven't been rolled back
        cur.execute("""
            SELECT id, table_name, operation, record_id, before_data, after_data
            FROM operation_log
            WHERE session_id = %s AND rolled_back_at IS NULL
            ORDER BY sequence DESC
            LIMIT %s
        """, (str(session_id), steps))

        operations = [dict(row) for row in cur.fetchall()]

        if not operations:
            return {
                'success': True,
                'rolled_back': 0,
                'message': 'No operations to rollback'
            }

        undone = []

        for op in operations:
            table = op['table_name']
            operation = op['operation']
            record_id = op['record_id']
            before_data = op['before_data']
            after_data = op['after_data']

            try:
                if operation == 'INSERT':
                    # Reverse INSERT: delete the inserted record
                    if record_id:
                        cur.execute(f"DELETE FROM {table} WHERE id = %s", (record_id,))
                    undone.append({'action': 'deleted', 'table': table, 'id': record_id})

                elif operation == 'UPDATE':
                    # Reverse UPDATE: restore before_data
                    if before_data and record_id:
                        # Remove id and timestamps from before_data
                        restore_data = {k: v for k, v in before_data.items()
                                       if k not in ('id', 'created_at', 'updated_at')}
                        set_clauses = ', '.join([f"{k} = %s" for k in restore_data.keys()])
                        cur.execute(
                            f"UPDATE {table} SET {set_clauses} WHERE id = %s",
                            list(restore_data.values()) + [record_id]
                        )
                    undone.append({'action': 'restored', 'table': table, 'id': record_id})

                elif operation == 'DELETE':
                    # Reverse DELETE: re-insert the deleted record
                    if before_data:
                        # Remove auto-generated fields
                        insert_data = {k: v for k, v in before_data.items()
                                      if k not in ('id', 'created_at', 'updated_at')}
                        columns = list(insert_data.keys())
                        values = list(insert_data.values())
                        placeholders = ', '.join(['%s'] * len(values))
                        col_names = ', '.join(columns)
                        cur.execute(
                            f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) RETURNING id",
                            values
                        )
                        new_id = cur.fetchone()['id']
                        undone.append({'action': 'restored', 'table': table, 'id': new_id, 'original_id': record_id})

                # Mark operation as rolled back
                cur.execute(
                    "UPDATE operation_log SET rolled_back_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (op['id'],)
                )

            except Exception as e:
                undone.append({'action': 'error', 'table': table, 'id': record_id, 'error': str(e)})

        return {
            'success': True,
            'rolled_back': len(undone),
            'operations': undone
        }


def get_operation_history(session_id: UUID, limit: int = 10) -> dict:
    """Get recent operations for a session.

    Args:
        session_id: UUID of the chat session
        limit: Maximum number of operations to return (default 10)

    Returns:
        Dict with 'operations' list
    """
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                sequence,
                table_name,
                operation,
                record_id,
                created_at,
                rolled_back_at IS NOT NULL as is_rolled_back
            FROM operation_log
            WHERE session_id = %s
            ORDER BY sequence DESC
            LIMIT %s
        """, (str(session_id), limit))

        operations = serialize_rows([dict(row) for row in cur.fetchall()])

        return {
            'success': True,
            'session_id': str(session_id),
            'operations': operations,
            'count': len(operations)
        }
