# Vela AI

A full-stack autonomous AI agent platform. Give Vela a task and it plans, calls tools, and reports back, with tools for browsing the live web, searching, running code and reading GitHub repositories.

## Features

- **Agent loop with a tool registry** (`server/agent.ts`), where the LLM decides which tool to call
- **Browser tool:** headless Playwright navigation to extract live page content
- **Web search** for docs, facts and up-to-date information
- **Code execution:** run JavaScript/Node snippets and calculations
- **GitHub tools:** list a user's repos and read files for review or refactoring
- **Auth, database and file storage** built in (sessions via JWT cookies, S3-compatible storage)
- Responsive React UI with a component library (Radix UI + Tailwind)

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Radix UI, wouter, TanStack Query |
| Backend | Node.js, Express, tRPC, Zod |
| Database | MySQL / TiDB via Drizzle ORM |
| Automation | Playwright (Chromium) |
| Testing | Vitest |
| Hosting | Render (`render.yaml` included) |

## Getting started

```bash
git clone https://github.com/Goddy36-A/vela-ai.git
cd vela-ai
pnpm install
cp .env.example .env   # then fill in the values below (create the file if it does not exist)
pnpm db:push           # generate and run migrations
pnpm dev               # start the dev server
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm test`, `pnpm check` (type-check).

### Environment variables

| Key | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Secret used to sign session cookies |
| `GITHUB_PAT` | GitHub token (`repo` scope) for the GitHub tools |
| `BUILT_IN_FORGE_API_KEY` | API key for the built-in AI gateway and storage |
| `OAUTH_SERVER_URL` | OAuth backend base URL |

## Deployment

See [DEPLOY_RENDER.md](DEPLOY_RENDER.md) for the Render walkthrough, including the OAuth redirect and cookie settings that matter on `*.onrender.com`.

## Status

Deployed and working on Render. OAuth callback handling for external domains is still being audited (see `todo.md`).

## Author

**Ainebyoona Godfrey**, Uganda. [GitHub](https://github.com/Goddy36-A)
