#!/bin/bash

# ML Agent Backup Script
# Creates daily backups of database and logs

BACKUP_DIR="/root/ml-agent/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mlagent_db"
DB_USER="mlagent"
DB_PASS="mlagent2025"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
PGPASSWORD=$DB_PASS pg_dump -U $DB_USER -h localhost $DB_NAME > "$BACKUP_DIR/db_backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/db_backup_$DATE.sql"

# Backup logs
tar -czf "$BACKUP_DIR/logs_backup_$DATE.tar.gz" /root/ml-agent/logs/ 2>/dev/null

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete

echo "[$(date)] Backup completed: db_backup_$DATE.sql.gz"