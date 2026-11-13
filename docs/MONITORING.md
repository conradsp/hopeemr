# Monitoring

Two layers, both alerting through [healthchecks.io](https://healthchecks.io) / an uptime service
so that a sole operator hears about problems without watching dashboards.

## 1. External uptime (works even if the server is dead)

Create HTTP monitors (UptimeRobot or healthchecks.io free tier, 5-minute interval) for:

| URL | Expect |
|-----|--------|
| `https://api.hopeemr.com/healthcheck` | HTTP 200 |
| `https://hopeemr.com/health` | HTTP 200 |

Alert by email and SMS/push. Also enable the uptime service's TLS-expiry warning, which
catches a broken certbot renewal before browsers start rejecting the site.

## 2. Server health (disk, memory, containers)

`scripts/check-health.sh` checks disk use (alert at 85%), available memory (alert under
150 MB), and that every compose service is running and healthy.

1. Create a healthchecks.io check with a 5-minute period and 10-minute grace.
2. Add `SERVER_HEALTHCHECK_URL=https://hc-ping.com/<uuid>` to `.env`.
3. Schedule it as root:

   ```bash
   cat > /etc/cron.d/hopeemr-health <<'CRON'
   */5 * * * * ubuntu /home/ubuntu/hopeemr/scripts/check-health.sh > /dev/null 2>&1
   CRON
   ```

A `/fail` ping carries the list of problems, which healthchecks.io includes in the alert.
Silence for longer than the grace period also alerts (server down, cron broken).

## 3. Backups

Covered in [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md): a separate daily check.
