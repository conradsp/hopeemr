# Backup and Restore

HopeEMR backs up nightly to an encrypted [restic](https://restic.net) repository on Backblaze B2.
Each run stores two snapshots:

| Tag | Contents | Source |
|-----|----------|--------|
| `postgres` | Full database dump (`pg_dump -Fc`) | `postgres` container |
| `binary` | Uploaded attachments and images | `medplum-server` binary storage volume |

Retention: 14 daily, 8 weekly, 12 monthly snapshots per tag.

A backup that is never restored is not a backup. The restore drill below is part of Phase 0
Gate 1 and should be repeated quarterly.

## One-time setup

1. **Backblaze B2.** Create a private bucket (e.g. `hopeemr-backups`) and an application key
   restricted to that bucket. Note the key ID and key.
2. **Healthcheck.** Create a check at [healthchecks.io](https://healthchecks.io) (free tier) with
   a 1-day period and 2-hour grace. Point its alerts at your email/phone. Copy the ping URL.
3. **Secrets.** On the server, add to `.env` (see `.env.production.example`):

   ```bash
   B2_ACCOUNT_ID=<key id>
   B2_ACCOUNT_KEY=<key>
   RESTIC_REPOSITORY=b2:hopeemr-backups:postgres
   RESTIC_PASSWORD=<openssl rand -base64 32>
   BACKUP_HEALTHCHECK_URL=https://hc-ping.com/<uuid>
   ```

4. **Store `RESTIC_PASSWORD` outside the server** (password manager, plus a sealed copy with a
   trusted second person). Without it the backups cannot be decrypted. Losing the server and
   this password together means losing all data.
5. **First run** (initializes the repository):

   ```bash
   ./scripts/backup.sh
   ```

6. **Schedule it.** As root:

   ```bash
   cat > /etc/cron.d/hopeemr-backup <<'EOF'
   # Nightly at 02:30 server time; Sundays also verify a 5% data sample
   30 2 * * 1-6 ubuntu /home/ubuntu/hopeemr/scripts/backup.sh >> /var/log/hopeemr-backup.log 2>&1
   30 2 * * 0   ubuntu /home/ubuntu/hopeemr/scripts/backup.sh --check >> /var/log/hopeemr-backup.log 2>&1
   EOF
   ```

   Adjust the user and path to match the server. The user must be able to run `docker`.

## How you find out it failed

The script pings `/start`, then the success URL or `/fail`. healthchecks.io alerts on `/fail`
**and** when no ping arrives at all (cron broken, server down, disk full). No alert means the
last backup succeeded.

## Restore drill (quarterly)

Do this on a **scratch server**, never production.

1. Create a small Lightsail instance, run `scripts/setup-server.sh`, clone the repo.
2. Copy the production `.env`, then change `MEDPLUM_SERVER_URL` / `MEDPLUM_APP_URL` to the
   scratch hostname so it cannot be confused with production.
3. Bring the stack up: `./deploy.sh --full`.
4. List snapshots: `./scripts/restore.sh --list`.
5. Restore: `./scripts/restore.sh --confirm-overwrite` and type `RESTORE`.
6. Verify: sign in, open a known patient, open an uploaded attachment, check the newest
   encounter date matches the backup date.
7. Record the date, snapshot IDs, time taken, and any problems in the log below. Destroy the
   scratch server.

## Disaster recovery

Same as the drill, on the replacement production server, followed by pointing DNS at it.
Expect to lose at most one day of data (the time since the last nightly backup).

## Drill log

| Date | Snapshots restored | Duration | Result / notes |
|------|--------------------|----------|----------------|
| | | | |
