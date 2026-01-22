#!/bin/bash
# Database restore script
# Restores from a backup file
#
# Usage: ./scripts/restore_db.sh backups/galipo_backup_YYYYMMDD_HHMMSS.sql
# Requires: DATABASE_URL environment variable

set -e

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable not set"
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql>"
    echo ""
    echo "Available backups:"
    ls -la backups/*.sql 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    # Try decompressing if .gz exists
    if [ -f "${BACKUP_FILE}.gz" ]; then
        echo "Decompressing ${BACKUP_FILE}.gz..."
        gunzip -k "${BACKUP_FILE}.gz"
    else
        echo "Error: Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

echo "WARNING: This will overwrite the current database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo "Restoring database..."
psql "$DATABASE_URL" < "$BACKUP_FILE"

echo "Restore complete."
