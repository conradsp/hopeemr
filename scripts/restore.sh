#!/usr/bin/env bash
#
# HopeEMR restore from restic backup
#
# DESTRUCTIVE: replaces the current database and binary storage with a snapshot.
# Intended for (1) the quarterly restore drill on a scratch server and
# (2) real disaster recovery. See docs/BACKUP_AND_RESTORE.md.
#
# Usage: ./scripts/restore.sh --list
#        ./scripts/restore.sh --confirm-overwrite
#
#   Restores the latest postgres and binary snapshots. To restore an older point,
#   pick IDs from --list and pin them:
#   POSTGRES_SNAPSHOT=ab12cd34 BINARY_SNAPSHOT=ef56ab78 ./scripts/restore.sh --confirm-overwrite
#
# Prerequisite: the stack is up (./deploy.sh --full) so the containers and volumes exist.

set -euo pipefail

cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY in .env}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD in .env}"
: "${B2_ACCOUNT_ID:?Set B2_ACCOUNT_ID in .env}"
: "${B2_ACCOUNT_KEY:?Set B2_ACCOUNT_KEY in .env}"
: "${REDIS_PASSWORD:?Set REDIS_PASSWORD in .env}"

COMPOSE=(docker compose -f docker-compose-emr-https.yml)
RESTIC_IMAGE="restic/restic:0.19.1"

restic() {
  local docker_args=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    docker_args+=("$1")
    shift
  done
  shift
  docker run --rm -i \
    -e RESTIC_REPOSITORY -e RESTIC_PASSWORD -e B2_ACCOUNT_ID -e B2_ACCOUNT_KEY \
    -v hopeemr_restic_cache:/root/.cache/restic \
    "${docker_args[@]}" \
    "$RESTIC_IMAGE" "$@"
}

if [ "${1:-}" = "--list" ]; then
  restic -- snapshots
  exit 0
fi

if [ "${1:-}" != "--confirm-overwrite" ]; then
  echo "Refusing to run: this replaces the database and binary storage." >&2
  echo "Run with --list to see snapshots, or --confirm-overwrite to restore." >&2
  exit 1
fi

POSTGRES_SNAPSHOT="${POSTGRES_SNAPSHOT:-latest}"
BINARY_SNAPSHOT="${BINARY_SNAPSHOT:-latest}"

echo "Restoring postgres snapshot '$POSTGRES_SNAPSHOT' and binary snapshot '$BINARY_SNAPSHOT'"
echo "into the stack defined by docker-compose-emr-https.yml on $(hostname)."
read -r -p "Type RESTORE to continue: " answer
if [ "$answer" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

MEDPLUM_CONTAINER="$("${COMPOSE[@]}" ps -aq medplum-server)"
if [ -z "$MEDPLUM_CONTAINER" ]; then
  echo "medplum-server container not found; bring the stack up first." >&2
  exit 1
fi

echo "Stopping medplum-server so nothing writes during the restore..."
"${COMPOSE[@]}" stop medplum-server

echo "Restoring Postgres..."
restic -- dump --tag postgres "$POSTGRES_SNAPSHOT" medplum.dump \
  | "${COMPOSE[@]}" exec -T postgres pg_restore -U medplum -d medplum --clean --if-exists --no-owner

echo "Restoring binary storage..."
restic --volumes-from "$MEDPLUM_CONTAINER" -- restore "$BINARY_SNAPSHOT" --tag binary --target /

echo "Flushing Redis (Medplum caches resources there; stale entries would mask the restore)..."
"${COMPOSE[@]}" exec -T redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning FLUSHALL

echo "Starting medplum-server..."
"${COMPOSE[@]}" start medplum-server

echo "Restore complete. Verify: sign in, open a known patient, open an uploaded attachment."
