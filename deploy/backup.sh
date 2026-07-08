#!/usr/bin/env bash
# Nightly backup of the Veronis database. Add to cron:
#   0 4 * * * /opt/veronis/deploy/backup.sh >> /var/log/veronis-backup.log 2>&1
set -euo pipefail

DATA=/opt/veronis/server/data
DEST=/opt/veronis/backups
STAMP=$(date +%Y-%m-%d_%H%M)

mkdir -p "$DEST"

# Consistent snapshot even while the server is running (SQLite online backup)
sqlite3 "$DATA/veronis.db" ".backup '$DEST/veronis-$STAMP.db'"
gzip "$DEST/veronis-$STAMP.db"

# Keep 30 days locally
find "$DEST" -name 'veronis-*.db.gz' -mtime +30 -delete

# OFFSITE COPY — uncomment after `rclone config` (e.g. Backblaze B2, ~free at this size).
# A backup that lives on the same disk as the data is not a backup.
# rclone copy "$DEST/veronis-$STAMP.db.gz" b2:veronis-backups/

echo "backup done: veronis-$STAMP.db.gz"
