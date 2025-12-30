# 📋 Medplum EMR Deployment Checklist

Use this checklist to ensure a smooth deployment of your Medplum EMR application.

## 🎯 Choose Your Deployment Type

- [ ] **Development/Testing** → Use `docker-compose-emr.yml`
- [ ] **Production** → Use `docker-compose-emr-production.yml`

---

## 📦 Pre-Deployment (All Environments)

### System Preparation
- [ ] Ubuntu 20.04+ installed
- [ ] At least 4GB RAM available (8GB recommended for production)
- [ ] At least 20GB free disk space
- [ ] Stable internet connection

### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in
```

- [ ] Docker installed and running
- [ ] Docker Compose v2+ installed
- [ ] Current user added to docker group

### Verify Installation
```bash
docker --version
docker compose version
```

- [ ] Docker version 20.10 or higher
- [ ] Docker Compose version 2.0 or higher

### Check Ports
```bash
sudo lsof -i :3000
sudo lsof -i :8103
sudo lsof -i :5432
sudo lsof -i :6379
```

- [ ] Port 3000 available (EMR App)
- [ ] Port 8103 available (Medplum Server)
- [ ] Port 5432 available (PostgreSQL)
- [ ] Port 6379 available (Redis)

---

## 🚀 Development/Testing Deployment

### Quick Start
```bash
cd /path/to/medplum
docker compose -f docker-compose-emr.yml up -d
```

- [ ] All services started
- [ ] Wait 1-2 minutes for initialization

### Verify Services
```bash
docker compose -f docker-compose-emr.yml ps
```

- [ ] postgres: healthy
- [ ] redis: healthy
- [ ] medplum-server: healthy
- [ ] emr-app: healthy

### Test Access
- [ ] EMR App loads: http://localhost:3000
- [ ] API responds: http://localhost:8103/healthcheck
- [ ] Can register new account
- [ ] Can log in successfully

### View Logs (if issues)
```bash
docker compose -f docker-compose-emr.yml logs -f
```

---

## 🏭 Production Deployment

### 1. Configuration Setup

#### Copy Environment Template
```bash
cp examples/emr/.env.example .env
```

- [ ] .env file created

#### Edit .env File
```bash
nano .env
```

**Required Changes:**
- [ ] Set `POSTGRES_PASSWORD` (strong password)
- [ ] Set `REDIS_PASSWORD` (strong password)
- [ ] Set `MEDPLUM_BASE_URL` (your domain)
- [ ] Set `MEDPLUM_APP_BASE_URL` (your domain)
- [ ] Set `MEDPLUM_STORAGE_BASE_URL` (your domain)
- [ ] Set `MEDPLUM_ALLOWED_ORIGINS` (your domain, not *)
- [ ] Set `MEDPLUM_INTROSPECTION_ENABLED=false`

**Optional but Recommended:**
- [ ] Configure `MEDPLUM_SUPPORT_EMAIL`
- [ ] Configure OAuth if needed
- [ ] Configure reCAPTCHA if needed

### 2. SSL/TLS Setup

**Choose one:**

#### Option A: Reverse Proxy (Recommended)
- [ ] Install nginx or Traefik
- [ ] Configure SSL certificates (Let's Encrypt recommended)
- [ ] Set up reverse proxy rules
- [ ] Update MEDPLUM_BASE_URL to use https://
- [ ] Update MEDPLUM_APP_BASE_URL to use https://

#### Option B: Direct SSL in Docker
- [ ] Obtain SSL certificates
- [ ] Mount certificates in docker-compose
- [ ] Configure nginx.conf for SSL
- [ ] Update environment URLs

### 3. Security Hardening

- [ ] All passwords changed from defaults
- [ ] CORS restricted to specific domains
- [ ] Introspection disabled
- [ ] Firewall configured (ufw or iptables)
- [ ] Only necessary ports exposed
- [ ] Database not exposed externally
- [ ] Redis not exposed externally

### 4. Deploy Production Stack

```bash
docker compose -f docker-compose-emr-production.yml --env-file .env up -d
```

- [ ] All services started
- [ ] Wait 2-3 minutes for initialization

### 5. Verify Production Deployment

```bash
docker compose -f docker-compose-emr-production.yml ps
```

- [ ] All services show "healthy"
- [ ] No error messages in logs

```bash
docker compose -f docker-compose-emr-production.yml logs
```

- [ ] No critical errors in logs

### 6. Test Production Access

- [ ] HTTPS works (no certificate errors)
- [ ] EMR App loads at your domain
- [ ] API responds at your domain
- [ ] Can register new account
- [ ] Can log in successfully
- [ ] Can create test patient
- [ ] Can navigate all pages

### 7. Backup Configuration

#### Set Up Automated Backups
```bash
# Create backup script
cat > /usr/local/bin/backup-medplum.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/medplum"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
docker compose -f /path/to/docker-compose-emr-production.yml exec -T postgres \
  pg_dump -U medplum medplum | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup volumes
docker run --rm -v medplum_postgres_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/postgres_data_$DATE.tar.gz /data

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-medplum.sh
```

- [ ] Backup script created
- [ ] Backup script tested
- [ ] Backup directory has sufficient space

#### Schedule Backups
```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-medplum.sh") | crontab -
```

- [ ] Cron job configured
- [ ] Backup schedule verified

#### Test Restore
```bash
# Test restore from backup
docker compose -f docker-compose-emr-production.yml exec -T postgres \
  psql -U medplum medplum < backup.sql
```

- [ ] Restore tested successfully

### 8. Monitoring Setup (Optional but Recommended)

#### Option A: Basic Monitoring
```bash
# Check services regularly
watch docker compose -f docker-compose-emr-production.yml ps
```

#### Option B: Advanced Monitoring
- [ ] Prometheus configured
- [ ] Grafana configured
- [ ] Alerts configured
- [ ] Log aggregation set up

### 9. Documentation

- [ ] Document your specific configuration
- [ ] Document custom environment variables
- [ ] Document backup/restore procedures
- [ ] Document any custom modifications
- [ ] Share access credentials securely

### 10. Final Production Checks

#### Security Audit
- [ ] All default passwords changed
- [ ] SSL/TLS working correctly
- [ ] Firewall rules in place
- [ ] Database not publicly accessible
- [ ] Redis not publicly accessible
- [ ] CORS properly restricted
- [ ] Introspection disabled
- [ ] Security headers present

#### Performance Check
- [ ] Application loads quickly
- [ ] API responds quickly
- [ ] Database queries are fast
- [ ] No memory issues
- [ ] No CPU bottlenecks

#### Functionality Check
- [ ] User registration works
- [ ] User login works
- [ ] Patient creation works
- [ ] Encounter creation works
- [ ] All major features tested
- [ ] Mobile responsive
- [ ] Cross-browser tested

---

## 📊 Post-Deployment

### Monitoring
- [ ] Set up uptime monitoring
- [ ] Configure error alerting
- [ ] Monitor disk space
- [ ] Monitor memory usage
- [ ] Monitor CPU usage
- [ ] Review logs regularly

### Maintenance Schedule
- [ ] Daily: Check service health
- [ ] Daily: Review error logs
- [ ] Weekly: Check disk space
- [ ] Weekly: Review backup success
- [ ] Monthly: Update Docker images
- [ ] Monthly: Security updates
- [ ] Quarterly: Full security audit

### Documentation
- [ ] Deployment date recorded
- [ ] Configuration documented
- [ ] Access credentials secured
- [ ] Backup procedures documented
- [ ] Incident response plan created

---

## 🆘 Troubleshooting Checklist

If something goes wrong:

### Services Won't Start
- [ ] Check Docker is running: `docker ps`
- [ ] Check logs: `docker compose logs`
- [ ] Check disk space: `df -h`
- [ ] Check memory: `free -h`
- [ ] Verify .env file syntax
- [ ] Check port conflicts

### Application Not Accessible
- [ ] Verify services are healthy
- [ ] Check firewall rules
- [ ] Verify DNS configuration
- [ ] Check SSL certificates
- [ ] Review nginx/proxy logs
- [ ] Test with curl/wget

### Database Issues
- [ ] Check PostgreSQL logs
- [ ] Verify database credentials
- [ ] Check database connections
- [ ] Verify disk space
- [ ] Check PostgreSQL health

### Performance Issues
- [ ] Check resource usage
- [ ] Review slow query logs
- [ ] Check for memory leaks
- [ ] Verify resource limits
- [ ] Consider scaling up

---

## ✅ Deployment Complete!

Once all items are checked:

- [ ] **Development**: Ready for testing
- [ ] **Production**: Ready for users

### Next Steps

**For Development:**
1. Start developing features
2. Test thoroughly
3. Prepare for production

**For Production:**
1. Monitor closely for first 24 hours
2. Gather user feedback
3. Plan regular maintenance
4. Keep documentation updated

---

## 📞 Support Resources

- **Documentation**: See `examples/emr/DEPLOYMENT.md`
- **Quick Start**: See `QUICKSTART.md`
- **Medplum Docs**: https://www.medplum.com/docs
- **Docker Docs**: https://docs.docker.com/

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Environment**: [ ] Development [ ] Production  
**Version**: _______________

