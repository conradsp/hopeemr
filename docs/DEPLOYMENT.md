# EMR Application Deployment Guide

This guide explains how to deploy the Medplum EMR application with Docker Compose on Ubuntu.

## Prerequisites

### System Requirements
- Ubuntu 20.04 or later
- At least 4GB RAM
- At least 20GB free disk space
- Docker Engine 20.10 or later
- Docker Compose v2.0 or later

### Install Docker on Ubuntu

```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt install apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key:
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add the repository to Apt sources:
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
apt-cache policy docker-ce

sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

### Verify Installation

```bash
sudo systemctl status docker
docker --version
docker compose version
```

## Deployment Steps

### 1. Clone or Copy the Repository

```bash
# If using git
git clone <repository-url>
cd medplum

# Or copy the files to your Ubuntu server
```

### 2. Navigate to the Project Root

```bash
cd /path/to/medplum
```

### 3. Build and Start the Services

```bash
# Build and start all services
docker compose -f docker-compose-emr.yml up -d

# Or if you want to see the logs in real-time (remove -d flag)
docker compose -f docker-compose-emr.yml up
```

### 4. Monitor the Startup

```bash
# Check the status of all services
docker compose -f docker-compose-emr.yml ps

# View logs for all services
docker compose -f docker-compose-emr.yml logs -f

# View logs for a specific service
docker compose -f docker-compose-emr.yml logs -f emr-app
docker compose -f docker-compose-emr.yml logs -f medplum-server
```

### 5. Wait for Services to be Healthy

The services will start in the following order:
1. PostgreSQL (database)
2. Redis (cache)
3. Medplum Server (backend API)
4. EMR App (frontend)

Wait for all health checks to pass (usually 1-2 minutes).

### 6. Access the Application

Once all services are healthy:

- **EMR Application**: http://localhost:3000
- **Medplum Server API**: http://localhost:8103
- **API Health Check**: http://localhost:8103/healthcheck

## Initial Setup

### First Time Setup

1. Navigate to http://localhost:3000
2. Click "Register" to create a new account
3. Fill in the registration form
4. You'll be redirected to create a new project
5. Complete the project setup

### Create Super Admin (Optional)

If you need to create a super admin user:

```bash
# Access the medplum-server container
docker compose -f docker-compose-emr.yml exec medplum-server sh

# Run the super admin creation script (if available)
# Or use the Medplum CLI tools
```

## Configuration

### Environment Variables

You can customize the deployment by setting environment variables:

```bash
# Create a .env file in the project root
cat > .env << EOF
MEDPLUM_BASE_URL=http://your-server-ip:8103/
MEDPLUM_APP_BASE_URL=http://your-server-ip:3000/
EOF

# Then run with the .env file
docker compose -f docker-compose-emr.yml --env-file .env up -d
```

### Custom Configuration File

To use a custom Medplum configuration:

```bash
# Set the config path
export MEDPLUM_CONFIG_PATH=/path/to/your/medplum.config.json

# Start the services
docker compose -f docker-compose-emr.yml up -d
```

## Production Considerations

### 1. Use a Reverse Proxy

For production, use nginx or Traefik as a reverse proxy:

```nginx
# Example nginx configuration
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # EMR Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Medplum API
    location /api/ {
        proxy_pass http://localhost:8103/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Secure Database Credentials

```bash
# Change default passwords in docker-compose-emr.yml
# Update these values:
- POSTGRES_PASSWORD=<strong-password>
- MEDPLUM_DATABASE_PASSWORD=<strong-password>
- MEDPLUM_REDIS_PASSWORD=<strong-password>
```

### 3. Enable SSL/TLS

Update the Medplum server environment variables:

```yaml
environment:
  MEDPLUM_BASE_URL: 'https://your-domain.com/api/'
  MEDPLUM_APP_BASE_URL: 'https://your-domain.com/'
```

### 4. Set Up Backups

```bash
# Backup PostgreSQL
docker compose -f docker-compose-emr.yml exec postgres pg_dump -U medplum medplum > backup.sql

# Backup volumes
docker run --rm -v medplum_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore from backup
docker compose -f docker-compose-emr.yml exec -T postgres psql -U medplum medplum < backup.sql
```

### 5. Configure Resource Limits

Add resource limits to docker-compose-emr.yml:

```yaml
services:
  emr-app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Maintenance

### Update Services

```bash
# Pull latest images
docker compose -f docker-compose-emr.yml pull

# Restart services with new images
docker compose -f docker-compose-emr.yml up -d
```

### View Logs

```bash
# All services
docker compose -f docker-compose-emr.yml logs -f

# Specific service
docker compose -f docker-compose-emr.yml logs -f emr-app

# Last 100 lines
docker compose -f docker-compose-emr.yml logs --tail=100
```

### Restart Services

```bash
# Restart all services
docker compose -f docker-compose-emr.yml restart

# Restart specific service
docker compose -f docker-compose-emr.yml restart emr-app
```

### Stop Services

```bash
# Stop all services
docker compose -f docker-compose-emr.yml stop

# Stop and remove containers (data persists in volumes)
docker compose -f docker-compose-emr.yml down

# Stop and remove everything including volumes (CAUTION: deletes data)
docker compose -f docker-compose-emr.yml down -v
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune
```

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker compose -f docker-compose-emr.yml ps

# Check logs for errors
docker compose -f docker-compose-emr.yml logs

# Restart services
docker compose -f docker-compose-emr.yml restart
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose -f docker-compose-emr.yml ps postgres

# Check PostgreSQL logs
docker compose -f docker-compose-emr.yml logs postgres

# Connect to PostgreSQL
docker compose -f docker-compose-emr.yml exec postgres psql -U medplum
```

### EMR App Build Issues

```bash
# Rebuild the EMR app
docker compose -f docker-compose-emr.yml build --no-cache emr-app

# Check build logs
docker compose -f docker-compose-emr.yml logs emr-app
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :8103

# Kill the process or change ports in docker-compose-emr.yml
```

### Health Check Failures

```bash
# Check health status
docker compose -f docker-compose-emr.yml ps

# Manually test health endpoints
curl http://localhost:8103/healthcheck
curl http://localhost:3000/health
```

## Performance Tuning

### PostgreSQL Optimization

Add to docker-compose-emr.yml under postgres service:

```yaml
command:
  - 'postgres'
  - '-c'
  - 'max_connections=200'
  - '-c'
  - 'shared_buffers=256MB'
  - '-c'
  - 'effective_cache_size=1GB'
  - '-c'
  - 'maintenance_work_mem=64MB'
  - '-c'
  - 'checkpoint_completion_target=0.9'
  - '-c'
  - 'wal_buffers=16MB'
  - '-c'
  - 'default_statistics_target=100'
```

### Redis Optimization

```yaml
redis:
  command: redis-server --requirepass medplum --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## Monitoring

### Set Up Monitoring (Optional)

Consider adding monitoring tools:

- **Prometheus** for metrics
- **Grafana** for dashboards
- **Loki** for log aggregation

Example prometheus configuration:

```yaml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - '9090:9090'
    networks:
      - medplum-network
```

## Support

For issues and questions:
- Check the logs: `docker compose -f docker-compose-emr.yml logs`
- Review Medplum documentation: https://www.medplum.com/docs
- Check Docker documentation: https://docs.docker.com/

## Security Checklist

- [ ] Change default passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Enable audit logging
- [ ] Configure resource limits
- [ ] Use secrets management
- [ ] Keep Docker images updated
- [ ] Monitor security advisories
- [ ] Implement access controls

## Quick Reference

```bash
# Start services
docker compose -f docker-compose-emr.yml up -d

# Stop services
docker compose -f docker-compose-emr.yml down

# View logs
docker compose -f docker-compose-emr.yml logs -f

# Rebuild app
docker compose -f docker-compose-emr.yml build --no-cache emr-app

# Restart specific service
docker compose -f docker-compose-emr.yml restart emr-app

# Check status
docker compose -f docker-compose-emr.yml ps

# Backup database
docker compose -f docker-compose-emr.yml exec postgres pg_dump -U medplum medplum > backup.sql
```

