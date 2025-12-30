# Medplum EMR - Quick Start Guide

## 🚀 Deploy in 3 Steps

### Step 1: Prerequisites
```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in
```

### Step 2: Start Services
```bash
cd /path/to/medplum
docker compose -f docker-compose-emr.yml up -d
```

### Step 3: Access Application
- Open browser: http://localhost:3000
- Click "Register" to create account
- Complete setup wizard

## ✅ Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose-emr.yml ps

# Should show all services as "healthy"
```

## 📊 Service Status

| Service | Port | URL | Status Check |
|---------|------|-----|--------------|
| EMR App | 3000 | http://localhost:3000 | Browser |
| API Server | 8103 | http://localhost:8103 | http://localhost:8103/healthcheck |
| PostgreSQL | 5432 | localhost:5432 | `docker compose -f docker-compose-emr.yml exec postgres pg_isready` |
| Redis | 6379 | localhost:6379 | `docker compose -f docker-compose-emr.yml exec redis redis-cli -a medplum ping` |

## 🔧 Common Commands

```bash
# View logs
docker compose -f docker-compose-emr.yml logs -f

# Restart services
docker compose -f docker-compose-emr.yml restart

# Stop services
docker compose -f docker-compose-emr.yml down

# Update and restart
docker compose -f docker-compose-emr.yml pull
docker compose -f docker-compose-emr.yml up -d
```

## 🆘 Troubleshooting

### Services won't start
```bash
# Check logs for errors
docker compose -f docker-compose-emr.yml logs

# Restart all services
docker compose -f docker-compose-emr.yml restart
```

### Port conflicts
```bash
# Check what's using the port
sudo lsof -i :3000

# Change port in docker-compose-emr.yml if needed
```

### Reset everything
```bash
# ⚠️ WARNING: Deletes all data!
docker compose -f docker-compose-emr.yml down -v
docker compose -f docker-compose-emr.yml up -d
```

## 📚 Next Steps

- **Production Setup**: See `examples/emr/DEPLOYMENT.md`
- **Configuration**: Copy `examples/emr/.env.example` to `.env`
- **Documentation**: Visit https://www.medplum.com/docs

## 🔐 Security Checklist (Production)

- [ ] Change default passwords in `.env`
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall
- [ ] Set up backups
- [ ] Disable introspection
- [ ] Restrict CORS origins
- [ ] Use secrets management

## 📁 Project Structure

```
medplum/
├── docker-compose-emr.yml       ← Main deployment file
├── QUICKSTART.md               ← This file
└── examples/emr/
    ├── Dockerfile              ← EMR app build
    ├── nginx.conf              ← Web server config
    ├── .env.example            ← Configuration template
    ├── DEPLOYMENT.md           ← Detailed guide
    └── README.docker.md        ← Docker reference
```

## 💡 Tips

1. **First Run**: Initial startup takes 1-2 minutes for database initialization
2. **Logs**: Use `-f` flag to follow logs in real-time
3. **Updates**: Pull new images regularly with `docker compose pull`
4. **Backups**: Set up automated database backups (see DEPLOYMENT.md)
5. **Monitoring**: Consider adding Prometheus/Grafana for production

## 🎯 Quick Reference Card

```bash
# Start
docker compose -f docker-compose-emr.yml up -d

# Stop
docker compose -f docker-compose-emr.yml down

# Logs
docker compose -f docker-compose-emr.yml logs -f [service]

# Status
docker compose -f docker-compose-emr.yml ps

# Rebuild
docker compose -f docker-compose-emr.yml build --no-cache emr-app

# Backup DB
docker compose -f docker-compose-emr.yml exec postgres \
  pg_dump -U medplum medplum > backup.sql

# Restore DB
docker compose -f docker-compose-emr.yml exec -T postgres \
  psql -U medplum medplum < backup.sql
```

## 🌐 Production URLs

For production deployment, update these in `.env`:

```bash
MEDPLUM_BASE_URL=https://api.yourdomain.com/
MEDPLUM_APP_BASE_URL=https://emr.yourdomain.com/
MEDPLUM_ALLOWED_ORIGINS=https://emr.yourdomain.com
```

## 📞 Support

- **Issues**: Check logs first
- **Docs**: https://www.medplum.com/docs
- **Docker**: https://docs.docker.com/

---

**Ready to deploy?** Run: `docker compose -f docker-compose-emr.yml up -d`

