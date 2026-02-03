/**
 * generate-nginx.js
 * 
 * Reads port-registry.json and Ghost tags to auto-create Nginx configs:
 *   1. Creates /etc/nginx/sites-available/{domain} for each site
 *   2. Symlinks to sites-enabled
 *   3. Tests and reloads Nginx
 * 
 * Usage: sudo node generate-nginx.js
 * Requires: GHOST_URL, GHOST_ADMIN_KEY environment variables
 *           Must be run as root (writes to /etc/nginx/)
 */
const GhostAdminAPI = require('@tryghost/admin-api');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const REGISTRY_FILE = path.join(__dirname, 'port-registry.json');
const NGINX_AVAILABLE = '/etc/nginx/sites-available';
const NGINX_ENABLED = '/etc/nginx/sites-enabled';

// Allow configuration via environment variables
const API_URL = process.env.GHOST_URL || 'https://your-ghost-blog.com';
const API_KEY = process.env.GHOST_ADMIN_KEY || 'YOUR_ADMIN_API_KEY';

const api = new GhostAdminAPI({
    url: API_URL,
    key: API_KEY,
    version: 'v5.0'
});

function loadRegistry() {
    if (fs.existsSync(REGISTRY_FILE)) {
        return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    }
    throw new Error("❌ No port registry found. Run generate-infrastructure.js first!");
}

(async function main() {
    console.log("🔍 Reading Port Registry and Ghost Tags...");
    const registry = loadRegistry();

    // We need to fetch tags again to get the Domain Name (stored in description)
    let allTags;
    try {
        allTags = await api.tags.browse({ limit: 'all' });
    } catch (err) {
        console.error("Error fetching tags from Ghost:", err.message);
        process.exit(1);
    }

    let configsCreated = 0;

    // Loop through every site in our registry
    for (const [slug, port] of Object.entries(registry.sites)) {

        // 1. Find the domain for this site
        const tag = allTags.find(t => t.slug === slug);
        if (!tag) {
            console.warn(`⚠️  Tag ${slug} found in registry but missing in Ghost. Skipping.`);
            continue;
        }

        // Parse description: "domain=example.com; image=ghcr.io/me/my-image:latest"
        const config = parseDescription(tag.description);
        const domain = config.domain || `${slug.replace('hash-site-', '')}.localhost`;

        const configPath = path.join(NGINX_AVAILABLE, domain);
        const symlinkPath = path.join(NGINX_ENABLED, domain);

        // 2. Check if Nginx config already exists
        if (fs.existsSync(configPath)) {
            console.log(`✅ Config already exists for ${domain}. Skipping.`);
            continue;
        }

        console.log(`🛠  Generating Nginx config for ${domain} on Port ${port}...`);

        // 3. Create the Nginx Content
        const nginxConfig = `server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};

    access_log /var/log/nginx/${domain}.access.log;
    error_log /var/log/nginx/${domain}.error.log;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;

        // 4. Write to sites-available
        fs.writeFileSync(configPath, nginxConfig);

        // 5. Create Symlink to sites-enabled
        if (!fs.existsSync(symlinkPath)) {
            fs.symlinkSync(configPath, symlinkPath);
            console.log(`🔗 Linked ${domain} to sites-enabled.`);
        }

        console.log(`✨ Created http://${domain}`);
        configsCreated++;
    }

    if (configsCreated === 0) {
        console.log("No new Nginx configs needed.");
        return;
    }

    // 6. Test and Reload Nginx
    try {
        console.log("Testing Nginx config...");
        execSync('nginx -t'); // Will throw error if config is bad
        console.log("Reloading Nginx...");
        execSync('systemctl reload nginx');
        console.log("🚀 Nginx reloaded successfully!");
    } catch (error) {
        console.error("❌ Nginx failed to reload. Check your config files.");
        console.error(error.message);
    }

})();

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
