# CMS-to-Astros

**Automatically spin up websites from Ghost CMS tags.**

Write content in Ghost, tag it with `#site-food` or `#site-tech`, and this system will automatically create and deploy a new website for that tag.

**Repository:** [mvvk-space/CMS-to-Astros](https://github.com/mvvk-space/CMS-to-Astros)

## Architecture

Ghost CMS content with `#site-*` tags → orchestrator scripts (generate-infrastructure) → generated Astro sites, deployed automatically.

## What's here

- `generator/` — the site generation machinery
- `app/` — the app layer
- `deploy.sh` — deployment script
- `crontab.example` — cron schedule for the automation loop
- [context-and-scripts.md](./context-and-scripts.md) — extensive notes on the system's context and scripts
- [README.md](./README.md) — full architecture docs (with diagrams)

## How it works

Tag a post in Ghost, and the system builds an Astro site for that tag — content pipeline, theming, and deployment all handled by the orchestrator scripts.