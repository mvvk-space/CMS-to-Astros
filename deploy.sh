#!/bin/bash
#
# deploy.sh - Master Deployment Script
#
# One-command deployment that runs all infrastructure scripts:
#   1. generate-infrastructure.js → Scans Ghost, assigns ports, creates Docker Compose
#   2. docker compose up -d → Starts/updates containers
#   3. generate-nginx.js → Creates Nginx configs (requires sudo)
#
# Usage: ./deploy.sh
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f generator/.env ]; then
    source generator/.env
fi

echo "======================================"
echo "🚀 CMS-to-Astros Deployment"
echo "======================================"

# Step 1: Generate Docker infrastructure
echo ""
echo "📦 Step 1: Scanning Ghost for tags and generating Docker Compose..."
node generator/generate-infrastructure.js

# Step 2: Start/Update Docker containers
echo ""
echo "🐳 Step 2: Starting Docker containers..."
docker compose -f docker-compose.generated.yml up -d

# Step 3: Generate Nginx configs (requires sudo)
echo ""
echo "🌐 Step 3: Generating Nginx configs..."
echo "   (This step requires sudo permissions)"
sudo node generator/generate-nginx.js

echo ""
echo "======================================"
echo "✅ Deployment Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Check your sites are running: docker ps"
echo "  2. For SSL, run: sudo certbot --nginx -d your-domain.com"
echo ""
