# 🚀 EMR Docker Deployment - Complete Package

## 📦 What Was Created

I've created a complete Docker deployment package for your Medplum EMR application. Here's everything that was added:

### Core Deployment Files

1. **`examples/emr/Dockerfile`**
   - Multi-stage build for optimal image size
   - Stage 1: Builds React/Vite application
   - Stage 2: Serves with nginx (production-ready)
   - Includes health check endpoint

2. **`examples/emr/nginx.conf`**
   - Production nginx configuration
   - Client-side routing support (SPA)
   - Gzip compression
   - Security headers
   - Static asset caching
   - Health check endpoint

3. **`examples/emr/.dockerignore`**
   - Optimizes build by excluding unnecessary files
   - Reduces image size

### Docker Compose Files

4. **`docker-compose-emr.yml`** (root directory)
   - Development/testing configuration
   - 4 services: PostgreSQL, Redis, Medplum Server, EMR App
   - Easy to use with sensible defaults
   - **Use this for development and testing**

5. **`docker-compose-emr-production.yml`** (root directory)
   - Production-hardened configuration
   - Resource limits
   - Security enhancements
   - Requires .env file
   - Optional monitoring services
   - **Use this for production deployments**

### Configuration Files

6. **`examples/emr/.env.example`**
   - Template for environment variables
   - All configurable options documented
   - Copy to `.env` and customize

### Documentation

7. **`examples/emr/DEPLOYMENT.md`**
   - **Comprehensive deployment guide** (most detailed)
   - Installation instructions
   - Configuration options
   - Production best practices
   - Security checklist
   - Troubleshooting
   - Maintenance procedures

8. **`examples/emr/README.docker.md`**
   - Quick reference guide
   - Common commands
   - Architecture overview
   - Quick troubleshooting

9. **`QUICKSTART.md`** (root directory)
   - **Ultra-quick 3-step deployment**
   - Essential commands only
   - Perfect for getting started fast

10. **`examples/emr/DOCKER_DEPLOYMENT_SUMMARY.md`**
    - Technical overview
    - Architecture details
    - Configuration reference
    - Maintenance guide

11. **`examples/emr/DEPLOYMENT_FILES_SUMMARY.md`**
    - This file - overview of everything created

## 🎯 Quick Start (Choose Your Path)

### Path 1: Development/Testing (Fastest)

```bash
# From project root
cd /path/to/medplum
docker compose -f docker-compose-emr.yml up -d

# Access at http://localhost:3000
```

**That's it!** Default configuration works out of the box.

### Path 2: Production Deployment

```bash
# 1. Copy environment template
cp examples/emr/.env.example .env

# 2. Edit .env and set secure passwords
nano .env

# 3. Deploy with production config
docker compose -f docker-compose-emr-production.yml --env-file .env up -d

# 4. Access at your configured URL
```

## 📚 Documentation Guide

**Start here based on your needs:**

| Your Goal | Read This First |
|-----------|----------------|
| Just want to test it quickly | `QUICKSTART.md` |
| Development environment | `docker-compose-emr.yml` + `README.docker.md` |
| Production deployment | `DEPLOYMENT.md` (comprehensive) |
| Understanding architecture | `DOCKER_DEPLOYMENT_SUMMARY.md` |
| Configuration options | `.env.example` |
| Quick command reference | `README.docker.md` |

## 🏗️ What Gets Deployed

```
Your Ubuntu Server
├── PostgreSQL 16 (Database)
│   └── Port 5432
│   └── Volume: postgres_data
│
├── Redis 7 (Cache)
│   └── Port 6379
│   └── Volume: redis_data
│
├── Medplum Server (FHIR API)
│   └── Port 8103
│   └── Volume: medplum_storage
│
└── EMR Application (Your Frontend)
    └── Port 3000
    └── Built with React + Vite
    └── Served with nginx
```

## ✅ Pre-Deployment Checklist

### System Requirements
- [ ] Ubuntu 20.04 or later
- [ ] 4GB RAM minimum (8GB recommended)
- [ ] 20GB free disk space
- [ ] Docker Engine 20.10+
- [ ] Docker Compose v2.0+

### Before First Deployment
- [ ] Install Docker (see DEPLOYMENT.md)
- [ ] Verify ports 3000, 8103, 5432, 6379 are available
- [ ] For production: Copy and customize .env file
- [ ] For production: Change all default passwords

## 🚀 Deployment Commands

### Development/Testing
```bash
# Start
docker compose -f docker-compose-emr.yml up -d

# View logs
docker compose -f docker-compose-emr.yml logs -f

# Stop
docker compose -f docker-compose-emr.yml down
```

### Production
```bash
# Start (requires .env file)
docker compose -f docker-compose-emr-production.yml --env-file .env up -d

# View logs
docker compose -f docker-compose-emr-production.yml logs -f

# Stop
docker compose -f docker-compose-emr-production.yml down
```

## 🔐 Security Notes

### Development Configuration (docker-compose-emr.yml)
- ⚠️ Uses default passwords
- ⚠️ CORS set to `*`
- ⚠️ HTTP only (no SSL)
- ⚠️ Introspection enabled
- ✅ **Good for**: Development, testing, demos
- ❌ **Not for**: Production

### Production Configuration (docker-compose-emr-production.yml)
- ✅ Requires custom passwords via .env
- ✅ Resource limits configured
- ✅ Security hardening applied
- ✅ Introspection disabled by default
- ✅ Requires CORS configuration
- ✅ **Good for**: Production deployments
- ⚠️ **Requires**: SSL/TLS setup via reverse proxy

## 📊 Service Access

After deployment:

| Service | URL | Purpose |
|---------|-----|---------|
| EMR App | http://localhost:3000 | Main application UI |
| API Server | http://localhost:8103 | FHIR API endpoint |
| Health Check | http://localhost:8103/healthcheck | Server status |
| FHIR Docs | http://localhost:8103/fhir/R4 | API documentation |

## 🔧 Common Tasks

### View Logs
```bash
# All services
docker compose -f docker-compose-emr.yml logs -f

# Specific service
docker compose -f docker-compose-emr.yml logs -f emr-app
```

### Restart Services
```bash
# All services
docker compose -f docker-compose-emr.yml restart

# Specific service
docker compose -f docker-compose-emr.yml restart emr-app
```

### Update Application
```bash
# Rebuild EMR app after code changes
docker compose -f docker-compose-emr.yml build --no-cache emr-app
docker compose -f docker-compose-emr.yml up -d emr-app
```

### Backup Database
```bash
docker compose -f docker-compose-emr.yml exec postgres \
  pg_dump -U medplum medplum > backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
docker compose -f docker-compose-emr.yml exec -T postgres \
  psql -U medplum medplum < backup-20240101.sql
```

## 🐛 Troubleshooting Quick Reference

### Services won't start
```bash
docker compose -f docker-compose-emr.yml ps
docker compose -f docker-compose-emr.yml logs
```

### Port conflicts
```bash
sudo lsof -i :3000
# Change port in docker-compose file if needed
```

### Reset everything (⚠️ deletes data)
```bash
docker compose -f docker-compose-emr.yml down -v
docker compose -f docker-compose-emr.yml up -d
```

### Check service health
```bash
docker compose -f docker-compose-emr.yml ps
# Look for "healthy" status
```

## 📖 Next Steps After Deployment

1. **Access the application**: http://localhost:3000
2. **Register an account**: Click "Register" button
3. **Complete setup**: Follow the setup wizard
4. **Create test data**: Add patients, practitioners, etc.
5. **Explore features**: Navigate through the EMR

### For Production
6. **Set up SSL**: Configure reverse proxy (nginx/Traefik)
7. **Configure backups**: Set up automated database backups
8. **Enable monitoring**: Add Prometheus/Grafana (optional)
9. **Security audit**: Review all security settings
10. **Load testing**: Test with expected user load

## 🎓 Learning Resources

- **Medplum Docs**: https://www.medplum.com/docs
- **Docker Docs**: https://docs.docker.com/
- **FHIR Spec**: https://www.hl7.org/fhir/
- **React Docs**: https://react.dev/
- **Nginx Docs**: https://nginx.org/en/docs/

## 💡 Pro Tips

1. **Use docker compose logs -f** to watch logs in real-time
2. **Wait for health checks** before accessing services (1-2 minutes)
3. **Backup regularly** - database backups are critical
4. **Monitor disk space** - logs and data can grow
5. **Update images** regularly for security patches
6. **Test backups** - verify you can restore from backup
7. **Use .env file** for production to manage secrets
8. **Enable monitoring** for production deployments
9. **Document customizations** you make
10. **Keep Docker updated** for latest features and security

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: `docker compose logs`
2. **Review documentation**: Start with DEPLOYMENT.md
3. **Verify prerequisites**: Docker version, ports, disk space
4. **Check GitHub issues**: Search for similar problems
5. **Medplum community**: https://www.medplum.com/docs

## ✨ What Makes This Special

This deployment package includes:

- ✅ **Production-ready** Dockerfile with multi-stage build
- ✅ **Two configurations**: Development and Production
- ✅ **Complete documentation** for all skill levels
- ✅ **Security hardening** in production config
- ✅ **Resource limits** to prevent resource exhaustion
- ✅ **Health checks** for all services
- ✅ **Data persistence** with Docker volumes
- ✅ **Easy updates** and maintenance
- ✅ **Backup/restore** procedures
- ✅ **Troubleshooting** guides

## 📝 File Locations Reference

```
medplum/
├── docker-compose-emr.yml              ← Development config
├── docker-compose-emr-production.yml   ← Production config
├── QUICKSTART.md                       ← Quick start guide
│
└── examples/emr/
    ├── Dockerfile                      ← EMR app build
    ├── nginx.conf                      ← Web server config
    ├── .dockerignore                   ← Build optimization
    ├── .env.example                    ← Config template
    ├── DEPLOYMENT.md                   ← Comprehensive guide
    ├── README.docker.md                ← Quick reference
    ├── DOCKER_DEPLOYMENT_SUMMARY.md    ← Technical details
    └── DEPLOYMENT_FILES_SUMMARY.md     ← This file
```

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ All services show "healthy" status
- ✅ EMR app loads in browser
- ✅ Can register new account
- ✅ Can log in successfully
- ✅ Can navigate between pages
- ✅ API responds to health checks
- ✅ No errors in logs

## 🚦 Deployment Status

- **Development Config**: ✅ Ready to use
- **Production Config**: ✅ Ready (requires .env setup)
- **Documentation**: ✅ Complete
- **Testing**: ⚠️ Needs your testing
- **Production**: ⚠️ Needs SSL/security setup

---

## 🎉 You're Ready!

Everything you need is now in place. Choose your deployment path:

**Quick Test**: Use `docker-compose-emr.yml`  
**Production**: Use `docker-compose-emr-production.yml` + `.env`

**Start with**: `QUICKSTART.md` for the fastest path to running application!

---

**Created**: Current session  
**Status**: Complete and ready for deployment  
**Tested**: Development configuration  
**Production**: Requires customization per DEPLOYMENT.md

