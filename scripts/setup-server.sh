#!/bin/bash
#
# HopeEMR Server Setup Script
# Run this ONCE on your Lightsail instance before deploying
#
# Usage: sudo ./scripts/setup-server.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HopeEMR Server Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo)${NC}"
    exit 1
fi

# =============================================================================
# 1. Setup Swap Space (2GB)
# =============================================================================
echo -e "${YELLOW}[1/4] Setting up swap space...${NC}"

SWAP_FILE="/swapfile"
SWAP_SIZE="2G"

if [ -f "$SWAP_FILE" ]; then
    echo "  Swap file already exists, checking size..."
    CURRENT_SIZE=$(ls -lh $SWAP_FILE | awk '{print $5}')
    echo "  Current swap: $CURRENT_SIZE"
else
    echo "  Creating ${SWAP_SIZE} swap file..."
    fallocate -l $SWAP_SIZE $SWAP_FILE
    chmod 600 $SWAP_FILE
    mkswap $SWAP_FILE
    swapon $SWAP_FILE

    # Make permanent
    if ! grep -q "$SWAP_FILE" /etc/fstab; then
        echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
    fi
    echo -e "  ${GREEN}Swap created and enabled${NC}"
fi

# Configure swappiness (low value = prefer RAM)
SWAPPINESS=10
echo "  Setting swappiness to $SWAPPINESS..."
sysctl vm.swappiness=$SWAPPINESS
if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
    echo "vm.swappiness=$SWAPPINESS" >> /etc/sysctl.conf
fi

# Show current swap
echo "  Current swap status:"
swapon --show
echo ""

# =============================================================================
# 2. Configure Docker Log Rotation (daemon level)
# =============================================================================
echo -e "${YELLOW}[2/4] Configuring Docker log rotation...${NC}"

DOCKER_DAEMON_CONFIG="/etc/docker/daemon.json"

# Create or update daemon.json
if [ -f "$DOCKER_DAEMON_CONFIG" ]; then
    echo "  Backing up existing daemon.json..."
    cp $DOCKER_DAEMON_CONFIG ${DOCKER_DAEMON_CONFIG}.backup
fi

cat > $DOCKER_DAEMON_CONFIG << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
EOF

echo -e "  ${GREEN}Docker daemon configured${NC}"
echo ""

# =============================================================================
# 3. Setup automatic Docker cleanup cron
# =============================================================================
echo -e "${YELLOW}[3/4] Setting up automatic cleanup...${NC}"

CRON_FILE="/etc/cron.daily/docker-cleanup"

cat > $CRON_FILE << 'EOF'
#!/bin/bash
# Daily Docker cleanup - remove unused images and build cache
docker system prune -af --filter "until=168h" > /var/log/docker-cleanup.log 2>&1
EOF

chmod +x $CRON_FILE
echo -e "  ${GREEN}Daily cleanup cron installed${NC}"
echo ""

# =============================================================================
# 4. Restart Docker to apply changes
# =============================================================================
echo -e "${YELLOW}[4/4] Restarting Docker...${NC}"
systemctl restart docker
echo -e "  ${GREEN}Docker restarted${NC}"
echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Changes applied:"
echo "  - Swap: ${SWAP_SIZE} at ${SWAP_FILE}"
echo "  - Swappiness: ${SWAPPINESS}"
echo "  - Docker logs: max 10MB x 3 files per container"
echo "  - Daily cleanup: removes images older than 7 days"
echo ""
echo "Next steps:"
echo "  1. cd /path/to/hopeemr"
echo "  2. git pull (to get the new production Dockerfile)"
echo "  3. ./deploy.sh --full --no-cache"
echo ""
echo -e "${YELLOW}Current system status:${NC}"
echo ""
echo "Memory:"
free -h
echo ""
echo "Disk:"
df -h /
echo ""
