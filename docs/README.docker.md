# Quick Start - Docker Deployment

## TL;DR

```bash
# From the project root directory
docker compose -f docker-compose-emr.yml up -d

# Wait for services to start (1-2 minutes)
# Then access the application at http://localhost:3000
```

## What Gets Deployed

This docker-compose setup deploys:

1. **PostgreSQL 16** - Database (port 5432)
2. **Redis 7** - Cache (port 6379)
3. **Medplum Server** - Backend API (port 8103)
4. **EMR Application** - Frontend UI (port 3000)

## File Structure

```
medplum/
├── docker-compose-emr.yml          # Main deployment file
└── examples/emr/
    ├── Dockerfile                   # EMR app build instructions
    ├── nginx.conf                   # Web server configuration
    ├── .dockerignore               # Files to exclude from build
    ├── DEPLOYMENT.md               # Detailed deployment guide
    └── README.docker.md            # This file
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- 4GB RAM minimum
- 20GB free disk space

## Quick Commands

```bash
# Start all services
docker compose -f docker-compose-emr.yml up -d

# View logs
docker compose -f docker-compose-emr.yml logs -f

# Check status
docker compose -f docker-compose-emr.yml ps

# Stop services
docker compose -f docker-compose-emr.yml down

# Rebuild EMR app
docker compose -f docker-compose-emr.yml build --no-cache emr-app
docker compose -f docker-compose-emr.yml up -d emr-app
```

## Access Points

- **EMR Application**: http://localhost:3000
- **Medplum API**: http://localhost:8103
- **API Docs**: http://localhost:8103/fhir/R4
- **Health Check**: http://localhost:8103/healthcheck

## First Time Setup

1. Navigate to http://localhost:3000
2. Click "Register" to create an account
3. Complete the registration form
4. Set up your project/organization
5. Start using the EMR!

## Troubleshooting

### Services won't start
```bash
# Check what's running
docker compose -f docker-compose-emr.yml ps

# View error logs
docker compose -f docker-compose-emr.yml logs
```

### Port already in use
```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :8103

# Either stop the conflicting service or change ports in docker-compose-emr.yml
```

### Database connection errors
```bash
# Restart the database
docker compose -f docker-compose-emr.yml restart postgres

# Check database logs
docker compose -f docker-compose-emr.yml logs postgres
```

### Clear everything and start fresh
```bash
# WARNING: This deletes all data!
docker compose -f docker-compose-emr.yml down -v
docker compose -f docker-compose-emr.yml up -d
```

## Data Persistence

Data is stored in Docker volumes:
- `postgres_data` - Database data
- `redis_data` - Cache data
- `medplum_storage` - File uploads

These persist even when containers are stopped/removed (unless you use `down -v`).

## Production Deployment

For production use, see [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- SSL/TLS configuration
- Reverse proxy setup
- Security hardening
- Backup strategies
- Monitoring setup
- Performance tuning

## Development vs Production

This setup is suitable for:
- ✅ Development
- ✅ Testing
- ✅ Demos
- ⚠️ Production (with modifications - see DEPLOYMENT.md)

For production, you should:
1. Change default passwords
2. Enable HTTPS
3. Set up backups
4. Configure monitoring
5. Use a reverse proxy
6. Implement proper security measures

## Need Help?

- **Detailed Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Medplum Docs**: https://www.medplum.com/docs
- **Docker Docs**: https://docs.docker.com/

## Architecture

```
┌─────────────────┐
│   EMR App       │  (React + Vite + Nginx)
│   Port 3000     │  Frontend UI
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Medplum Server  │  (Node.js)
│   Port 8103     │  FHIR API
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌─────────┐
│PostgreSQL│ │  Redis  │
│Port 5432│ │Port 6379│
└─────────┘ └─────────┘
```

## Environment Variables

Key environment variables (set in docker-compose-emr.yml):

```yaml
MEDPLUM_BASE_URL: 'http://localhost:8103/'
MEDPLUM_APP_BASE_URL: 'http://localhost:3000/'
MEDPLUM_DATABASE_HOST: 'postgres'
MEDPLUM_REDIS_HOST: 'redis'
```

To customize, either:
1. Edit `docker-compose-emr.yml` directly
2. Create a `.env` file with overrides
3. Pass environment variables at runtime

## Updating

```bash
# Pull latest Medplum server image
docker compose -f docker-compose-emr.yml pull medplum-server

# Rebuild EMR app with latest code
docker compose -f docker-compose-emr.yml build --no-cache emr-app

# Restart with new images
docker compose -f docker-compose-emr.yml up -d
```

## Backup

```bash
# Quick backup of database
docker compose -f docker-compose-emr.yml exec postgres pg_dump -U medplum medplum > backup-$(date +%Y%m%d).sql

# Restore from backup
docker compose -f docker-compose-emr.yml exec -T postgres psql -U medplum medplum < backup-20240101.sql
```

## License

See the main project LICENSE file.

