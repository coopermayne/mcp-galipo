#!/bin/bash
# Galipo Database Restore Script
# Usage: ./scripts/restore.sh <backup_file>
#
# Requires DATABASE_URL environment variable to be set.
# Restores from a backup created by backup.sh

set -e

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -la backups/*.sql.gz 2>/dev/null || echo "  No backups found in backups/"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will REPLACE ALL DATA in your database!"
echo "  Database: $DATABASE_URL"
echo "  Backup: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Restoring database..."

# Check if file is gzipped
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
else
    psql "$DATABASE_URL" < "$BACKUP_FILE"
fi

echo ""
echo "Restore completed successfully!"
