#!/bin/bash
#
# HopeEMR Deployment Script
# Usage: ./deploy.sh [options]
#
# Options:
#   --full      Rebuild all services (not just emr-app)
#   --no-cache  Force rebuild without cache
#   --logs      Follow logs after deployment
#
# First-time setup on server:
#   sudo ./scripts/setup-server.sh   # Configure swap + Docker log rotation
#   ./deploy.sh --full --no-cache    # Build and deploy all services
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose-emr-https.yml"
SERVICE="emr-app"

# Parse arguments
FULL_REBUILD=false
NO_CACHE=""
FOLLOW_LOGS=false

for arg in "$@"; do
  case $arg in
    --full)
      FULL_REBUILD=true
      shift
      ;;
    --no-cache)
      NO_CACHE="--no-cache"
      shift
      ;;
    --logs)
      FOLLOW_LOGS=true
      shift
      ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HopeEMR Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if docker compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}Error: $COMPOSE_FILE not found${NC}"
  echo "Make sure you're running this from the project root directory"
  exit 1
fi

# Step 1: Pull latest code
echo -e "${YELLOW}[1/4] Pulling latest code...${NC}"
git pull origin main
echo ""

# Step 2: Show what changed
echo -e "${YELLOW}[2/4] Recent changes:${NC}"
git log --oneline -5
echo ""

# Step 3: Build
echo -e "${YELLOW}[3/4] Building Docker image(s)...${NC}"
if [ "$FULL_REBUILD" = true ]; then
  echo "  -> Full rebuild of all services"
  docker compose -f "$COMPOSE_FILE" build $NO_CACHE
else
  echo "  -> Rebuilding $SERVICE only"
  docker compose -f "$COMPOSE_FILE" build $NO_CACHE "$SERVICE"
fi
echo ""

# Step 4: Deploy
echo -e "${YELLOW}[4/4] Deploying...${NC}"
if [ "$FULL_REBUILD" = true ]; then
  docker compose -f "$COMPOSE_FILE" up -d
else
  docker compose -f "$COMPOSE_FILE" up -d "$SERVICE"
fi
echo ""

# Show status
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${YELLOW}Container Status:${NC}"
docker compose -f "$COMPOSE_FILE" ps
echo ""

# Health check
echo -e "${YELLOW}Waiting for health check...${NC}"
sleep 5

if docker compose -f "$COMPOSE_FILE" ps "$SERVICE" | grep -q "healthy"; then
  echo -e "${GREEN}✓ $SERVICE is healthy${NC}"
elif docker compose -f "$COMPOSE_FILE" ps "$SERVICE" | grep -q "running"; then
  echo -e "${YELLOW}⏳ $SERVICE is running (health check pending)${NC}"
else
  echo -e "${RED}✗ $SERVICE may have issues - check logs${NC}"
fi
echo ""

# Clean up old images (all unused, not just dangling)
echo -e "${YELLOW}Cleaning up old Docker images...${NC}"
docker image prune -a -f
echo ""

# Show disk usage
echo -e "${YELLOW}Docker disk usage:${NC}"
docker system df
echo ""

# Follow logs if requested
if [ "$FOLLOW_LOGS" = true ]; then
  echo -e "${YELLOW}Following logs (Ctrl+C to exit)...${NC}"
  docker compose -f "$COMPOSE_FILE" logs -f "$SERVICE" --tail=50
fi
