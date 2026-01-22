#!/bin/bash
# Galipo Database Backup Script
# Usage: ./scripts/backup.sh [output_file]
#
# Requires DATABASE_URL environment variable to be set.
# Creates a complete backup including schema and data.

set -e

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

# Default backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${1:-backups/galipo_backup_${TIMESTAMP}.sql}"
BACKUP_DIR=$(dirname "$BACKUP_FILE")

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup..."
echo "  Database: $DATABASE_URL"
echo "  Output: $BACKUP_FILE"

# Create backup with pg_dump
# --no-owner: Don't output ownership commands (portable across different users)
# --no-acl: Don't output access privilege commands
# --clean: Include DROP statements before CREATE
# --if-exists: Use IF EXISTS with DROP statements
pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

# Compress the backup
gzip -f "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Calculate file size
SIZE=$(ls -lh "$COMPRESSED_FILE" | awk '{print $5}')

echo ""
echo "Backup completed successfully!"
echo "  File: $COMPRESSED_FILE"
echo "  Size: $SIZE"
echo ""
echo "To restore this backup, run:"
echo "  gunzip -c $COMPRESSED_FILE | psql \$DATABASE_URL"
