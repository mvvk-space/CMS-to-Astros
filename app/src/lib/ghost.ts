/**
 * ghost.ts - Ghost Content API Client
 * 
 * Drop-in helper for Astro sites to fetch content from Ghost CMS.
 * Automatically filters content by SITE_TAG environment variable.
 * 
 * Environment Variables (passed by Docker):
 *   - GHOST_URL: Your Ghost instance URL
 *   - GHOST_KEY: Ghost Content API key
 *   - SITE_TAG: The tag to filter content by (e.g., "hash-site-tech")
 * 
 * Usage in Astro:
 *   import { getSitePosts, getPost } from '../lib/ghost';
 *   const posts = await getSitePosts();
 */
import GhostContentAPI from '@tryghost/content-api';

// Initialize automatically from Env Vars (passed by Docker)
const api = new GhostContentAPI({
    url: import.meta.env.GHOST_URL,
    key: import.meta.env.GHOST_KEY,
    version: "v5.0"
});

// The Orchestrator passes SITE_TAG automatically
const siteTag = import.meta.env.SITE_TAG;

/**
 * Get all posts for THIS site (filtered by SITE_TAG)
 */
export async function getSitePosts() {
    return await api.posts.browse({
        filter: `tag:${siteTag}`,
        include: 'tags,authors',
        limit: 'all'
    });
}

/**
 * Get a single post by slug
 */
export async function getPost(slug: string) {
    return await api.posts.read({
        slug: slug
    }, { include: 'tags,authors' });
}

/**
 * Get all pages for THIS site
 */
export async function getSitePages() {
    return await api.pages.browse({
        filter: `tag:${siteTag}`,
        include: 'tags,authors',
        limit: 'all'
    });
}

/**
 * Get site settings (title, description, etc.)
 */
export async function getSettings() {
    return await api.settings.browse();
}
