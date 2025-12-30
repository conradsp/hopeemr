# Docker Deployment - Summary of Changes

## 📦 Files Created

### 1. Docker Configuration Files

#### `examples/emr/Dockerfile`
- **Purpose**: Multi-stage Dockerfile for building the EMR application
- **Features**:
  - Stage 1: Builds the React/Vite application
  - Stage 2: Serves built files with nginx
  - Optimized for production with minimal image size
  - Includes health check endpoint

#### `examples/emr/nginx.conf`
- **Purpose**: Nginx web server configuration
- **Features**:
  - Serves static files efficiently
  - Handles client-side routing (SPA support)
  - Gzip compression enabled
  - Security headers configured
  - Cache control for static assets
  - Health check endpoint at `/health`

#### `examples/emr/.dockerignore`
- **Purpose**: Excludes unnecessary files from Docker build
- **Excludes**: node_modules, build artifacts, IDE files, logs, etc.

### 2. Docker Compose File

#### `docker-compose-emr.yml` (root directory)
- **Purpose**: Complete deployment orchestration
- **Services**:
  1. **postgres**: PostgreSQL 16 database
  2. **redis**: Redis 7 cache
  3. **medplum-server**: Medplum FHIR API server
  4. **emr-app**: Custom EMR frontend application
- **Features**:
  - Health checks for all services
  - Proper service dependencies
  - Named volumes for data persistence
  - Custom network for service communication
  - Environment variable configuration

### 3. Documentation

#### `examples/emr/DEPLOYMENT.md`
- **Purpose**: Comprehensive deployment guide
- **Contents**:
  - System requirements
  - Docker installation instructions
  - Step-by-step deployment process
  - Configuration options
  - Production considerations
  - Security checklist
  - Troubleshooting guide
  - Maintenance procedures
  - Performance tuning
  - Backup/restore procedures

#### `examples/emr/README.docker.md`
- **Purpose**: Quick reference guide
- **Contents**:
  - Quick start commands
  - Architecture diagram
  - Common troubleshooting
  - Development vs production notes

#### `examples/emr/.env.example`
- **Purpose**: Environment variable template
- **Contents**:
  - All configurable environment variables
  - Commented examples
  - Production settings
  - Security notes

#### `QUICKSTART.md` (root directory)
- **Purpose**: Ultra-quick deployment guide
- **Contents**:
  - 3-step deployment process
  - Quick reference commands
  - Troubleshooting tips
  - Security checklist

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Network                       │
│                    (medplum-network)                     │
│                                                          │
│  ┌──────────────┐         ┌──────────────┐             │
│  │   EMR App    │         │   Medplum    │             │
│  │   (nginx)    │────────▶│    Server    │             │
│  │  Port 3000   │         │  Port 8103   │             │
│  └──────────────┘         └──────┬───┬───┘             │
│                                   │   │                  │
│                          ┌────────┘   └────────┐        │
│                          ▼                     ▼         │
│                   ┌──────────┐         ┌──────────┐     │
│                   │PostgreSQL│         │  Redis   │     │
│                   │Port 5432 │         │Port 6379 │     │
│                   └──────────┘         └──────────┘     │
│                          │                     │         │
│                          ▼                     ▼         │
│                   ┌──────────┐         ┌──────────┐     │
│                   │ Volume:  │         │ Volume:  │     │
│                   │postgres_ │         │ redis_   │     │
│                   │   data   │         │  data    │     │
│                   └──────────┘         └──────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Deployment Process

### Quick Start
```bash
# From project root
docker compose -f docker-compose-emr.yml up -d

# Access at http://localhost:3000
```

### What Happens During Deployment

1. **Network Creation**: Creates `medplum-network` for service communication
2. **Volume Creation**: Creates persistent volumes for data
3. **PostgreSQL Start**: Database initializes and becomes healthy
4. **Redis Start**: Cache starts and becomes healthy
5. **Medplum Server Start**: API server connects to DB and Redis
6. **EMR App Build**: Frontend is built and served with nginx
7. **Health Checks**: All services report healthy status

## 🔧 Configuration Options

### Environment Variables (in docker-compose-emr.yml)

**Server URLs:**
- `MEDPLUM_BASE_URL`: API server base URL
- `MEDPLUM_APP_BASE_URL`: Frontend app base URL
- `MEDPLUM_STORAGE_BASE_URL`: File storage URL

**Database:**
- `MEDPLUM_DATABASE_HOST`: Database hostname
- `MEDPLUM_DATABASE_PORT`: Database port
- `MEDPLUM_DATABASE_USERNAME`: Database user
- `MEDPLUM_DATABASE_PASSWORD`: Database password

**Redis:**
- `MEDPLUM_REDIS_HOST`: Redis hostname
- `MEDPLUM_REDIS_PORT`: Redis port
- `MEDPLUM_REDIS_PASSWORD`: Redis password

**Security:**
- `MEDPLUM_ALLOWED_ORIGINS`: CORS allowed origins
- `MEDPLUM_INTROSPECTION_ENABLED`: Enable/disable API introspection

### Customization Methods

1. **Edit docker-compose-emr.yml directly**
2. **Create .env file** (copy from .env.example)
3. **Use MEDPLUM_CONFIG_PATH** for custom config file

## 📊 Service Details

### PostgreSQL (Database)
- **Image**: postgres:16
- **Port**: 5432
- **Volume**: postgres_data
- **Health Check**: pg_isready
- **Configuration**: Optimized for FHIR workloads

### Redis (Cache)
- **Image**: redis:7
- **Port**: 6379
- **Volume**: redis_data
- **Health Check**: redis-cli ping
- **Configuration**: Password protected

### Medplum Server (API)
- **Image**: medplum/medplum-server:latest
- **Port**: 8103
- **Volume**: medplum_storage (for file uploads)
- **Health Check**: /healthcheck endpoint
- **Features**: Full FHIR R4 API

### EMR App (Frontend)
- **Build**: Custom Dockerfile
- **Port**: 3000 (maps to nginx port 80)
- **Base Image**: nginx:alpine
- **Health Check**: /health endpoint
- **Features**: React SPA with client-side routing

## 🔐 Security Considerations

### Default Configuration (Development)
- ⚠️ Default passwords (change for production!)
- ⚠️ CORS set to `*` (restrict for production!)
- ⚠️ HTTP only (use HTTPS for production!)
- ⚠️ Introspection enabled (disable for production!)

### Production Recommendations
1. **Change all default passwords**
2. **Enable HTTPS/SSL**
3. **Restrict CORS origins**
4. **Disable introspection**
5. **Use secrets management**
6. **Set up firewall rules**
7. **Enable audit logging**
8. **Configure resource limits**
9. **Set up monitoring**
10. **Implement backup strategy**

## 📈 Performance Tuning

### Resource Limits (Example)
```yaml
services:
  emr-app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

### PostgreSQL Optimization
- Shared buffers: 256MB
- Effective cache size: 1GB
- Max connections: 200
- See DEPLOYMENT.md for full configuration

### Redis Optimization
- Max memory: 256MB
- Eviction policy: allkeys-lru

## 🔄 Maintenance

### Common Operations

**View Logs:**
```bash
docker compose -f docker-compose-emr.yml logs -f [service]
```

**Restart Service:**
```bash
docker compose -f docker-compose-emr.yml restart [service]
```

**Update Images:**
```bash
docker compose -f docker-compose-emr.yml pull
docker compose -f docker-compose-emr.yml up -d
```

**Backup Database:**
```bash
docker compose -f docker-compose-emr.yml exec postgres \
  pg_dump -U medplum medplum > backup.sql
```

**Restore Database:**
```bash
docker compose -f docker-compose-emr.yml exec -T postgres \
  psql -U medplum medplum < backup.sql
```

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose-emr.yml
2. **Services won't start**: Check logs with `docker compose logs`
3. **Database connection errors**: Verify postgres is healthy
4. **Build failures**: Clear cache with `--no-cache` flag
5. **Health check failures**: Wait longer or check service logs

### Debug Commands

```bash
# Check service status
docker compose -f docker-compose-emr.yml ps

# View all logs
docker compose -f docker-compose-emr.yml logs

# Connect to database
docker compose -f docker-compose-emr.yml exec postgres psql -U medplum

# Connect to Redis
docker compose -f docker-compose-emr.yml exec redis redis-cli -a medplum

# Shell into container
docker compose -f docker-compose-emr.yml exec emr-app sh
```

## 📝 Next Steps

### For Development
1. Start services: `docker compose -f docker-compose-emr.yml up -d`
2. Access app: http://localhost:3000
3. Make changes to code
4. Rebuild: `docker compose -f docker-compose-emr.yml build emr-app`
5. Restart: `docker compose -f docker-compose-emr.yml up -d emr-app`

### For Production
1. Review DEPLOYMENT.md thoroughly
2. Copy .env.example to .env and customize
3. Change all default passwords
4. Set up SSL/TLS certificates
5. Configure reverse proxy (nginx/Traefik)
6. Set up monitoring (Prometheus/Grafana)
7. Configure backups
8. Test disaster recovery
9. Deploy to production
10. Monitor and maintain

## 📚 Documentation Reference

- **Quick Start**: `QUICKSTART.md`
- **Detailed Deployment**: `examples/emr/DEPLOYMENT.md`
- **Docker Reference**: `examples/emr/README.docker.md`
- **Environment Config**: `examples/emr/.env.example`
- **This Summary**: `examples/emr/DOCKER_DEPLOYMENT_SUMMARY.md`

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Docker installed and running
- [ ] Ports 3000, 8103, 5432, 6379 available
- [ ] Sufficient disk space (20GB+)
- [ ] Sufficient RAM (4GB+)

### Deployment
- [ ] Clone/copy repository
- [ ] Review docker-compose-emr.yml
- [ ] Customize .env if needed
- [ ] Run `docker compose up -d`
- [ ] Wait for health checks
- [ ] Access application

### Post-Deployment
- [ ] Create admin account
- [ ] Test basic functionality
- [ ] Configure backups
- [ ] Set up monitoring
- [ ] Document any customizations

### Production Additional
- [ ] Change default passwords
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Set up reverse proxy
- [ ] Disable introspection
- [ ] Restrict CORS
- [ ] Enable audit logging
- [ ] Test backup/restore
- [ ] Load testing
- [ ] Security audit

## 🎯 Success Criteria

Your deployment is successful when:
- ✅ All services show "healthy" status
- ✅ EMR app loads at http://localhost:3000
- ✅ Can register new account
- ✅ Can log in successfully
- ✅ Can navigate between pages
- ✅ API responds at http://localhost:8103/healthcheck
- ✅ No errors in logs

## 📞 Support Resources

- **Medplum Documentation**: https://www.medplum.com/docs
- **Docker Documentation**: https://docs.docker.com/
- **FHIR Specification**: https://www.hl7.org/fhir/
- **React Documentation**: https://react.dev/
- **Vite Documentation**: https://vitejs.dev/

---

**Created**: Current session  
**Purpose**: Docker deployment for Medplum EMR application  
**Status**: Ready for deployment  
**Tested**: Development environment  
**Production Ready**: With modifications (see DEPLOYMENT.md)

