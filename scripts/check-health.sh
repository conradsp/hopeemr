#!/usr/bin/env bash
#
# HopeEMR server health check (run every 5 minutes from cron)
#
# Checks disk space, available memory, and that every compose service is running
# and healthy. Pings SERVER_HEALTHCHECK_URL on success, or <url>/fail with the
# problems in the request body. healthchecks.io also alerts if pings stop arriving.
#
# Usage: ./scripts/check-health.sh
# Optional in .env: SERVER_HEALTHCHECK_URL, DISK_ALERT_PERCENT (85), MEM_ALERT_MB (150)

set -euo pipefail

cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

COMPOSE=(docker compose -f docker-compose-emr-https.yml)
DISK_ALERT_PERCENT="${DISK_ALERT_PERCENT:-85}"
MEM_ALERT_MB="${MEM_ALERT_MB:-150}"
problems=()

disk_used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if [ "$disk_used" -ge "$DISK_ALERT_PERCENT" ]; then
  problems+=("Disk ${disk_used}% used (threshold ${DISK_ALERT_PERCENT}%)")
fi

mem_available_mb="$(awk '/MemAvailable/ {print int($2 / 1024)}' /proc/meminfo)"
if [ "$mem_available_mb" -lt "$MEM_ALERT_MB" ]; then
  problems+=("Only ${mem_available_mb} MB memory available (threshold ${MEM_ALERT_MB} MB)")
fi

for service in $("${COMPOSE[@]}" config --services); do
  container="$("${COMPOSE[@]}" ps -q "$service")"
  if [ -z "$container" ]; then
    problems+=("Service $service is not running")
    continue
  fi
  status="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")"
  case "$status" in
    "running healthy" | "running ") ;;
    *) problems+=("Service $service is '$status'") ;;
  esac
done

if [ "${#problems[@]}" -eq 0 ]; then
  [ -n "${SERVER_HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 --retry 3 "$SERVER_HEALTHCHECK_URL" > /dev/null || true
  exit 0
fi

printf '%s\n' "${problems[@]}" >&2
if [ -n "${SERVER_HEALTHCHECK_URL:-}" ]; then
  printf '%s\n' "${problems[@]}" | curl -fsS -m 10 --retry 3 --data-binary @- "${SERVER_HEALTHCHECK_URL}/fail" > /dev/null || true
fi
exit 1
