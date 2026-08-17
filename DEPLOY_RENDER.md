# Deploying Vela AI to Render

Vela AI is a full-stack autonomous agent platform built with React, Vite, Express, tRPC, Drizzle ORM, MySQL/TiDB, Playwright, and GitHub Copilot integration.

## Why Authentication Failed on Render

When hosted on Render (e.g. `https://vela-ai.onrender.com`), authentication relies on Manus OAuth (`https://api.manus.im`). If authentication fails or redirects incorrectly on Render, it is usually caused by:
1. **Missing or Mismatched Environment Variables**: The Render service needs `DATABASE_URL`, `JWT_SECRET`, `GITHUB_PAT`, and `BUILT_IN_FORGE_API_KEY`.
2. **Cookie SameSite Settings**: When your Render app runs on `*.onrender.com` (HTTPS), session cookies must allow `sameSite: "none"` with `secure: true` (which the built-in Manus SDK and session cookie options handle automatically).
3. **OAuth Redirect URL Registration**: The OAuth provider must recognize your Render service URL as a valid redirect destination.

## Required Environment Variables on Render

In your Render dashboard under **Environment**, set the following environment variables:

| Key | Description | Required? |
|---|---|---|
| `NODE_ENV` | Set to `production` | Yes |
| `DATABASE_URL` | MySQL or TiDB connection string (e.g. `mysql://user:pass@host:port/db`) | Yes |
| `JWT_SECRET` | Secret key for signing session cookies | Yes (Render can auto-generate) |
| `GITHUB_PAT` | GitHub Personal Access Token with `repo` scope | Yes (for GitHub Copilot features) |
| `BUILT_IN_FORGE_API_KEY` | API key for built-in AI gateway & storage | Yes |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL (`https://api.manus.im`) | Yes |

## Step-by-Step Deployment

1. Connect your GitHub repository (`Goddy36-A/vela-ai`) to Render as a **Web Service**.
2. Render will automatically detect `render.yaml`.
3. Add the required environment variables listed above.
4. Click **Create Web Service**. Render will execute `pnpm install && pnpm build` and start the server with `pnpm start`.
