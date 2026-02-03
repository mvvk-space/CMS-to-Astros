#!/bin/bash
#
# nightly-archive.sh
#
# Builds static HTML snapshots of all #site-* tagged content:
#   1. Fetches all site tags from Ghost
#   2. Runs Astro build in static mode for each site
#   3. Saves to ../archives/{site-name}/{date}/
#
# Usage: ./nightly-archive.sh
# Recommended: Run via cron at 3 AM nightly
#   0 3 * * * cd /path/to/CMS-to-Astros && ./generator/nightly-archive.sh
#

# Configuration
# Load from .env or set defaults
source .env 2>/dev/null || true

GHOST_URL="${GHOST_URL:-https://your-ghost-blog.com}"
ADMIN_KEY="${GHOST_ADMIN_KEY:-YOUR_ADMIN_KEY}"
DATE=$(date +%Y-%m-%d)
ARCHIVE_ROOT="../archives"

echo "📦 Starting Nightly Archive for $DATE"

# 1. We re-use a tiny Node script just to get the list of tags (JSON output)
TAGS=$(node -e '
    const GhostAdminAPI = require("@tryghost/admin-api");
    const api = new GhostAdminAPI({ url: "'$GHOST_URL'", key: "'$ADMIN_KEY'", version: "v5.0" });
    api.tags.browse({limit: "all"}).then(tags => {
        const sites = tags.filter(t => t.slug.startsWith("hash-site-")).map(t => t.slug);
        console.log(sites.join(" "));
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
')

if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch tags from Ghost."
    exit 1
fi

# 2. Loop through each site tag
for TAG in $TAGS; do
    CLEAN_NAME=${TAG#"hash-site-"} # Remove prefix
    OUTPUT_DIR="$ARCHIVE_ROOT/$CLEAN_NAME/$DATE"
    
    echo "-----------------------------------"
    echo "📚 Archiving Site: $CLEAN_NAME ($TAG)"
    echo "📂 Destination: $OUTPUT_DIR"
    
    # 3. The Magic Command
    # We force BUILD_MODE=static so Astro uses the getStaticPaths config
    # We pass the SITE_TAG so it only fetches that content
    
    export BUILD_MODE="static"
    export SITE_TAG="$TAG"
    
    # Build directly into the archive folder
    # Note: Assuming the app is in ../app and has dependencies installed
    npm run build --prefix ../app -- --outDir $OUTPUT_DIR
    
    # Optional: Zip it for easier cold storage
    # tar -czf "$OUTPUT_DIR.tar.gz" -C "$OUTPUT_DIR" .
    
    echo "✅ Archived $CLEAN_NAME"
done

echo "🎉 All sites archived successfully."
