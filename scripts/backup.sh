#!/usr/bin/env bash
# Backs up EduKhata: the database (pg_dump custom format) and the private files directory.
#   DATABASE_URL=postgresql://... FILES_DIR=/data BACKUP_DIR=./backups RETAIN_DAYS=14 scripts/backup.sh
# Writes <BACKUP_DIR>/edukhata-<UTC time>.{dump,files.tar.gz,sha256}; deletes sets older than RETAIN_DAYS.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
FILES_DIR="${FILES_DIR:-}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="$BACKUP_DIR/edukhata-$stamp"
mkdir -p "$BACKUP_DIR"
umask 077

pg_dump --format=custom --no-owner --no-privileges --file="$base.dump" "$DATABASE_URL"
if [[ -n "$FILES_DIR" && -d "$FILES_DIR" ]]; then
  tar -czf "$base.files.tar.gz" -C "$FILES_DIR" .
fi
(cd "$BACKUP_DIR" && sha256sum "$(basename "$base")".* > "$(basename "$base").sha256")
find "$BACKUP_DIR" -name 'edukhata-*' -type f -mtime +"$RETAIN_DAYS" -delete
echo "Backup written: $base.*"
