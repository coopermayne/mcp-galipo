#!/bin/bash
# Galipo Data-Only Backup Script
# Usage: ./scripts/backup-data-only.sh [output_file]
#
# Creates a data-only backup (no schema). Use this when you want to:
# - Restore data to a fresh database with the latest schema
# - Migrate data between schema versions
#
# To restore:
# 1. Run schema.sql to create tables: psql $DATABASE_URL -f schema.sql
# 2. Run the data restore: gunzip -c backup.sql.gz | psql $DATABASE_URL

set -e

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${1:-backups/galipo_data_${TIMESTAMP}.sql}"
BACKUP_DIR=$(dirname "$BACKUP_FILE")

mkdir -p "$BACKUP_DIR"

echo "Starting data-only backup..."
echo "  Database: $DATABASE_URL"
echo "  Output: $BACKUP_FILE"

# Data-only backup with proper insert order (respecting foreign keys)
pg_dump "$DATABASE_URL" \
    --data-only \
    --no-owner \
    --no-acl \
    --disable-triggers \
    --column-inserts \
    > "$BACKUP_FILE"

gzip -f "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
SIZE=$(ls -lh "$COMPRESSED_FILE" | awk '{print $5}')

echo ""
echo "Data backup completed!"
echo "  File: $COMPRESSED_FILE"
echo "  Size: $SIZE"
echo ""
echo "To restore:"
echo "  1. Create schema: psql \$DATABASE_URL -f schema.sql"
echo "  2. Restore data:  gunzip -c $COMPRESSED_FILE | psql \$DATABASE_URL"
