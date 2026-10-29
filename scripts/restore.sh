#!/usr/bin/env bash
# Restores a backup made by backup.sh into an EMPTY database (and optionally a files dir).
#   TARGET_DATABASE_URL=postgresql://.../edukhata_restore scripts/restore.sh backups/edukhata-<stamp>
#   FILES_DIR=/data  — also unpack the files there (must be empty)
# Refuses a database that already has tables, so a live database can't be overwritten by accident.
set -euo pipefail
base="${1:?usage: restore.sh <backup path without extension>}"
: "${TARGET_DATABASE_URL:?set TARGET_DATABASE_URL}"
dir="$(dirname "$base")"
(cd "$dir" && sha256sum --check --quiet "$(basename "$base").sha256")

tables="$(psql "$TARGET_DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")"
if [[ "$tables" != "0" ]]; then
  echo "Refusing: the target database is not empty ($tables tables)." >&2
  exit 1
fi
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$TARGET_DATABASE_URL" "$base.dump"

if [[ -n "${FILES_DIR:-}" && -f "$base.files.tar.gz" ]]; then
  mkdir -p "$FILES_DIR"
  if [[ -n "$(ls -A "$FILES_DIR")" ]]; then
    echo "Refusing: $FILES_DIR is not empty." >&2
    exit 1
  fi
  tar -xzf "$base.files.tar.gz" -C "$FILES_DIR"
fi
echo "Restored $base into the target database."
