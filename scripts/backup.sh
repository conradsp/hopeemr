#!/usr/bin/env bash
#
# HopeEMR nightly backup
#
# Backs up the Postgres database (pg_dump custom format) and Medplum binary
# storage (uploaded attachments/images) to an encrypted restic repository on
# Backblaze B2, then applies the retention policy.
#
# Restic runs from its official container, so nothing extra is installed on the host.
# On success it pings BACKUP_HEALTHCHECK_URL; on failure it pings <url>/fail.
# A dead-man's-switch service (e.g. healthchecks.io) alerts if neither arrives.
#
# Usage: ./scripts/backup.sh            (run from cron, see docs/BACKUP_AND_RESTORE.md)
#        ./scripts/backup.sh --check    (also verify a 5% sample of stored data)
#
# Required in .env: POSTGRES_PASSWORD, RESTIC_REPOSITORY, RESTIC_PASSWORD,
#                   B2_ACCOUNT_ID, B2_ACCOUNT_KEY
# Optional in .env: BACKUP_HEALTHCHECK_URL

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

COMPOSE=(docker compose -f docker-compose-emr-https.yml)
RESTIC_IMAGE="restic/restic:0.19.1"
BINARY_PATH="/usr/src/medplum/packages/server/binary"
HEALTHCHECK_URL="${BACKUP_HEALTHCHECK_URL:-}"

ping_healthcheck() {
  if [ -n "$HEALTHCHECK_URL" ]; then
    curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}$1" > /dev/null || true
  fi
}

on_error() {
  echo "$(date -Is) BACKUP FAILED (line $1)" >&2
  ping_healthcheck "/fail"
}
trap 'on_error $LINENO' ERR

# Run restic in a throwaway container. Extra docker args (e.g. --volumes-from) go before "--".
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
    --hostname hopeemr-backup \
    "${docker_args[@]}" \
    "$RESTIC_IMAGE" "$@"
}

ping_healthcheck "/start"
echo "$(date -Is) Backup starting"

# First run: create the repository
if ! restic -- cat config > /dev/null 2>&1; then
  echo "Initializing restic repository at $RESTIC_REPOSITORY"
  restic -- init
fi

echo "Backing up Postgres..."
"${COMPOSE[@]}" exec -T postgres pg_dump -U medplum -Fc medplum \
  | restic -- backup --stdin --stdin-filename medplum.dump --tag postgres

echo "Backing up Medplum binary storage..."
MEDPLUM_CONTAINER="$("${COMPOSE[@]}" ps -q medplum-server)"
if [ -z "$MEDPLUM_CONTAINER" ]; then
  echo "medplum-server container is not running" >&2
  false
fi
restic --volumes-from "$MEDPLUM_CONTAINER":ro -- backup "$BINARY_PATH" --tag binary

echo "Applying retention policy..."
restic -- forget --prune --group-by tags --keep-daily 14 --keep-weekly 8 --keep-monthly 12

if [ "${1:-}" = "--check" ]; then
  echo "Verifying a 5% sample of repository data..."
  restic -- check --read-data-subset=5%
fi

echo "$(date -Is) Backup complete"
ping_healthcheck ""
