#!/bin/bash
# Blue-Green Deployment Script for jlam-staging
# Usage: ./scripts/deploy-blue-green.sh [commit_hash]

set -e

PROJECT_DIR="/opt/services/jlam-staging"
COMPOSE_FILE="docker-compose.production.yml"
SERVICE_NAME="jlam-staging"
HEALTH_URL="http://localhost:3000/api/health"

# Determine current and new color
CURRENT_COLOR=$(docker ps --filter "name=${SERVICE_NAME}" --format "{{.Names}}" | grep -oE "(blue|green)" | head -1 || echo "none")

if [ "$CURRENT_COLOR" = "blue" ]; then
    NEW_COLOR="green"
elif [ "$CURRENT_COLOR" = "green" ]; then
    NEW_COLOR="blue"
else
    NEW_COLOR="blue"
fi

echo "=== Blue-Green Deployment ==="
echo "Current: $CURRENT_COLOR"
echo "Deploying: $NEW_COLOR"
echo ""

cd "$PROJECT_DIR"

# Pull latest code if commit hash provided
if [ -n "$1" ]; then
    echo "Checking out commit: $1"
    git fetch origin
    git checkout "$1"
fi

# Build new container
echo "Building $NEW_COLOR container..."
COLOR=$NEW_COLOR docker compose -f "$COMPOSE_FILE" build

# Start new container
echo "Starting $NEW_COLOR container..."
COLOR=$NEW_COLOR docker compose -f "$COMPOSE_FILE" up -d

# Wait for health check
echo "Waiting for health check..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    if docker exec "${SERVICE_NAME}-${NEW_COLOR}" wget --spider -q "$HEALTH_URL" 2>/dev/null; then
        echo "Health check passed!"
        break
    fi
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "Health check failed after $MAX_ATTEMPTS attempts"
        echo "Rolling back..."
        docker stop "${SERVICE_NAME}-${NEW_COLOR}" 2>/dev/null || true
        docker rm "${SERVICE_NAME}-${NEW_COLOR}" 2>/dev/null || true
        exit 1
    fi
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting 5s..."
    sleep 5
done

# Update Traefik routing (handled via labels, just need to verify)
echo "Verifying Traefik routing..."
sleep 5

# Stop old container if it was running
if [ "$CURRENT_COLOR" != "none" ]; then
    echo "Stopping old $CURRENT_COLOR container..."
    docker stop "${SERVICE_NAME}-${CURRENT_COLOR}" 2>/dev/null || true
    docker rm "${SERVICE_NAME}-${CURRENT_COLOR}" 2>/dev/null || true
fi

# Cleanup old images
echo "Cleaning up old images..."
docker image prune -f

echo ""
echo "=== Deployment Complete ==="
echo "Service: $SERVICE_NAME"
echo "Color: $NEW_COLOR"
echo "URL: https://staging.jeleefstijlalsmedicijn.nl"
