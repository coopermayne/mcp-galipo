#!/bin/bash
# Database backup script
# Creates a timestamped backup of the entire database
#
# Usage: ./scripts/backup_db.sh
# Requires: DATABASE_URL environment variable

set -e

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable not set"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/galipo_backup_${TIMESTAMP}.sql"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# Also create a compressed version
gzip -k "$BACKUP_FILE"

echo "Backup complete:"
echo "  - $BACKUP_FILE"
echo "  - ${BACKUP_FILE}.gz"
echo ""
echo "To restore: psql \$DATABASE_URL < $BACKUP_FILE"
