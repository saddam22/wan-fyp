#!/usr/bin/env bash
# Restore drill: back up a database, restore it into a scratch database, compare, drop the scratch.
#   PG=postgresql://postgres:postgres@localhost:5432 SOURCE_DB=edukhata scripts/backup-drill.sh
set -euo pipefail
PG="${PG:?set PG (server URL without a database)}"
SOURCE_DB="${SOURCE_DB:-edukhata}"
DRILL_DB="${SOURCE_DB}_drill_$(date +%s)"
work="$(mktemp -d)"
trap 'psql "$PG/postgres" -qc "drop database if exists $DRILL_DB" >/dev/null; rm -rf "$work"' EXIT

DATABASE_URL="$PG/$SOURCE_DB" BACKUP_DIR="$work" RETAIN_DAYS=1 "$(dirname "$0")/backup.sh" >/dev/null
base="$(ls "$work"/edukhata-*.dump | sed 's/\.dump$//')"
psql "$PG/postgres" -qc "create database $DRILL_DB" >/dev/null
start=$(date +%s)
TARGET_DATABASE_URL="$PG/$DRILL_DB" "$(dirname "$0")/restore.sh" "$base" >/dev/null
took=$(( $(date +%s) - start ))

q='select (select count(*) from users), (select count(*) from orders), (select count(*) from payments),
           (select count(*) from ledger_entries), (select coalesce(sum(amount_minor), 0) from ledger_entries),
           (select count(*) from schema_migrations)'
a="$(psql "$PG/$SOURCE_DB" -Atc "$q")"
b="$(psql "$PG/$DRILL_DB" -Atc "$q")"
echo "source   users|orders|payments|ledger lines|ledger sum|migrations: $a"
echo "restored users|orders|payments|ledger lines|ledger sum|migrations: $b"
echo "dump size: $(du -h "$base.dump" | cut -f1); restore took ${took}s"
if [[ "$a" != "$b" ]]; then echo "DRILL FAILED: counts differ" >&2; exit 1; fi
# The restored ledger still enforces its rules (checked when it has entries).
lines="$(psql "$PG/$DRILL_DB" -Atc "select count(*) from ledger_entries")"
if [[ "$lines" != "0" ]] && psql "$PG/$DRILL_DB" -qc "update ledger_entries set amount_minor = amount_minor where false; delete from ledger_entries where id = (select min(id) from ledger_entries)" 2>/dev/null; then
  echo "DRILL FAILED: the restored ledger allowed a delete" >&2; exit 1
fi
echo "DRILL PASSED"
