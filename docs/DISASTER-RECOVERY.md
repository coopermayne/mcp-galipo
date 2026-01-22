# Galipo Disaster Recovery Guide

This document outlines how to backup, restore, and recover the Galipo database.

## Quick Reference

```bash
# Create a full backup
DATABASE_URL=your_url ./scripts/backup.sh

# Create a data-only backup
DATABASE_URL=your_url ./scripts/backup-data-only.sh

# Restore from backup
DATABASE_URL=your_url ./scripts/restore.sh backups/galipo_backup_20260122.sql.gz

# Rebuild from scratch with schema only
psql $DATABASE_URL -f schema.sql
```

## Backup Strategy

### Full Backup (Schema + Data)

Use `scripts/backup.sh` for complete backups that include both schema and data:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
./scripts/backup.sh
```

This creates a compressed file in `backups/galipo_backup_YYYYMMDD_HHMMSS.sql.gz`.

**When to use:** Regular backups, before major updates, before deployments.

### Data-Only Backup

Use `scripts/backup-data-only.sh` when you want to:
- Migrate data to a new schema version
- Restore data to a fresh database

```bash
./scripts/backup-data-only.sh
```

**When to use:** Before schema changes, when you want to rebuild with latest schema.

## Restore Procedures

### Scenario 1: Full Restore (Same Schema)

If your database is corrupted or you need to restore to a previous state:

```bash
./scripts/restore.sh backups/galipo_backup_20260122_120000.sql.gz
```

This will:
1. Drop existing tables
2. Recreate schema
3. Restore all data

### Scenario 2: Fresh Database with Latest Schema

If you need to rebuild the database from scratch:

```bash
# 1. Create fresh schema
psql $DATABASE_URL -f schema.sql

# 2. Start the application (it will seed lookup tables)
python main.py

# 3. (Optional) Restore data from data-only backup
gunzip -c backups/galipo_data_20260122.sql.gz | psql $DATABASE_URL
```

### Scenario 3: Complete Disaster Recovery

If everything is lost and you need to rebuild from scratch:

1. **Set up new PostgreSQL database** (Railway, Supabase, etc.)

2. **Get the DATABASE_URL** from your provider

3. **Create schema:**
   ```bash
   psql $DATABASE_URL -f schema.sql
   ```

4. **Deploy the application** (it will seed lookup tables on startup)

5. **Restore data from backup** (if you have one):
   ```bash
   gunzip -c backups/galipo_backup_LATEST.sql.gz | psql $DATABASE_URL
   ```

## File Locations

| File | Purpose |
|------|---------|
| `schema.sql` | Complete database schema (tables, indexes) |
| `scripts/backup.sh` | Create full backup (schema + data) |
| `scripts/backup-data-only.sh` | Create data-only backup |
| `scripts/restore.sh` | Restore from backup |
| `backups/` | Backup storage directory |
| `db/connection.py` | Contains `migrate_db()` for incremental migrations |

## Automated Backups

### Option 1: Cron Job (Self-hosted)

Add to crontab (`crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/galipo && DATABASE_URL=your_url ./scripts/backup.sh >> /var/log/galipo-backup.log 2>&1
```

### Option 2: Railway/Cloud Provider

Most cloud database providers offer automated backups. Check your provider's documentation:
- **Railway:** Automatic daily backups (Pro plan)
- **Supabase:** Point-in-time recovery
- **Neon:** Automatic branching and backups

### Option 3: GitHub Actions

Create `.github/workflows/backup.yml`:

```yaml
name: Database Backup
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client
      - name: Create backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: ./scripts/backup.sh backups/galipo_backup.sql
      - name: Upload backup artifact
        uses: actions/upload-artifact@v4
        with:
          name: database-backup-${{ github.run_number }}
          path: backups/galipo_backup.sql.gz
          retention-days: 30
```

## Testing Your Backups

**Important:** Periodically test your backups to ensure they work!

```bash
# 1. Create a test database
createdb galipo_test

# 2. Restore backup to test database
DATABASE_URL="postgresql://localhost/galipo_test" ./scripts/restore.sh backups/latest.sql.gz

# 3. Verify data
psql galipo_test -c "SELECT COUNT(*) FROM cases;"
psql galipo_test -c "SELECT COUNT(*) FROM tasks;"
psql galipo_test -c "SELECT COUNT(*) FROM events;"

# 4. Clean up
dropdb galipo_test
```

## Data Integrity Checks

Run these queries to verify data integrity after a restore:

```sql
-- Check row counts
SELECT 'cases' as table_name, COUNT(*) as count FROM cases
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'persons', COUNT(*) FROM persons
UNION ALL SELECT 'case_persons', COUNT(*) FROM case_persons
UNION ALL SELECT 'notes', COUNT(*) FROM notes
UNION ALL SELECT 'activities', COUNT(*) FROM activities;

-- Check for orphaned records
SELECT * FROM tasks WHERE case_id NOT IN (SELECT id FROM cases);
SELECT * FROM events WHERE case_id NOT IN (SELECT id FROM cases);
SELECT * FROM case_persons WHERE case_id NOT IN (SELECT id FROM cases);
SELECT * FROM case_persons WHERE person_id NOT IN (SELECT id FROM persons);
```

## Emergency Contacts

If you need help recovering:

1. Check Railway/hosting provider status page
2. Review deployment logs for errors
3. Open an issue on GitHub with error details
