/**
 * generate-infrastructure.js
 * 
 * Scans Ghost CMS for tags starting with "#site-" and:
 *   1. Assigns a stable port to each site (saved in port-registry.json)
 *   2. Parses domain and Docker image from tag description
 *   3. Generates docker-compose.generated.yml
 * 
 * Usage: node generate-infrastructure.js
 * Requires: GHOST_URL, GHOST_ADMIN_KEY environment variables
 * 
 * Tag Description Format: "domain=example.com; image=my-image:latest"
 */
const GhostAdminAPI = require('@tryghost/admin-api');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_PORT = 3000;
const REGISTRY_FILE = path.join(__dirname, 'port-registry.json');
const DOCKER_FILE = path.join(__dirname, '../docker-compose.generated.yml');

// Allow configuration via environment variables
const API_URL = process.env.GHOST_URL || 'https://your-ghost-blog.com';
const API_KEY = process.env.GHOST_ADMIN_KEY || 'YOUR_ADMIN_API_KEY';
const CONTENT_KEY = process.env.GHOST_CONTENT_KEY || 'YOUR_CONTENT_API_KEY';

const api = new GhostAdminAPI({
    url: API_URL,
    key: API_KEY,
    version: 'v5.0'
});

// Helper: Load or Initialize Registry
function loadRegistry() {
    if (fs.existsSync(REGISTRY_FILE)) {
        return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    }
    return { last_used_port: BASE_PORT, sites: {} };
}

// Helper to parse the description string
// Format: "domain=example.com; image=ghcr.io/me/my-image:latest"
function parseDescription(desc) {
    const config = { domain: '', image: 'my-astro-image:latest' };

    if (!desc) return config;

    desc.split(';').forEach(part => {
        const [key, value] = part.split('=').map(s => s.trim());
        if (key && value) config[key] = value;
    });
    return config;
}

(async function main() {
    console.log("🔍 Scanning Ghost for Site Tags...");
    let allTags;
    try {
        allTags = await api.tags.browse({ limit: 'all' });
    } catch (err) {
        console.error("Error fetching tags from Ghost:", err.message);
        console.error("Please check your GHOST_URL and GHOST_ADMIN_KEY.");
        process.exit(1);
    }

    // Filter for tags like '#site-tech', '#site-food'
    const siteTags = allTags.filter(tag => tag.slug.startsWith('hash-site-'));

    if (siteTags.length === 0) {
        console.log("No site tags found. Create a tag like '#site-myblog' in Ghost.");
        return;
    }

    console.log(`✅ Found ${siteTags.length} sites: ${siteTags.map(t => t.slug).join(', ')}`);

    // Load existing port assignments
    const registry = loadRegistry();
    let hasChanges = false;

    // 1. Assign Ports to New Sites
    siteTags.forEach(tag => {
        const siteSlug = tag.slug;

        // If this site isn't in our registry, give it a new port
        if (!registry.sites[siteSlug]) {
            registry.last_used_port += 1;
            registry.sites[siteSlug] = registry.last_used_port;
            console.log(`🆕 New Site Detected: ${siteSlug} -> Assigned Port ${registry.last_used_port}`);
            hasChanges = true;
        }
    });

    // 2. Save Registry (if changed)
    if (hasChanges) {
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
    }

    // 3. Generate Docker Compose
    console.log("🛠 Generating Docker Compose...");
    let composeFile = `version: '3'
services:
`;

    siteTags.forEach(tag => {
        const cleanName = tag.slug.replace('hash-site-', '');
        const port = registry.sites[tag.slug]; // Get the permanent port

        // Parse config from Ghost tag description
        const config = parseDescription(tag.description);

        composeFile += `
  ${cleanName}:
    image: ${config.image}
    restart: always
    environment:
      - SITE_TAG=${tag.slug}
      - HOST=0.0.0.0
      - GHOST_URL=${API_URL}
      - GHOST_KEY=${CONTENT_KEY}
    ports:
      - "${port}:4321"  # Maps Host Port -> Container Port
`;
    });

    fs.writeFileSync(DOCKER_FILE, composeFile);
    console.log(`✅ Done. Active sites: ${siteTags.length}`);
    console.log(`👉 Registry saved to ${REGISTRY_FILE}`);
    console.log(`👉 Docker Compose saved to ${DOCKER_FILE}`);
})();
