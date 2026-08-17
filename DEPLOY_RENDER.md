# Deploying Vela AI to Render

Vela AI is a full-stack autonomous agent platform built with React, Vite, Express, tRPC, Drizzle ORM, MySQL, Playwright, and GitHub Copilot integration.

## Prerequisites on Render

1. **PostgreSQL / MySQL Database**: Create a managed database on Render or provision an external MySQL/TiDB database and get the `DATABASE_URL` connection string.
2. **GitHub Personal Access Token (PAT)**: Ensure you have a valid GitHub PAT with `repo` scope for repository collaboration and push/PR features.

## Step-by-Step Deployment

1. Connect your GitHub repository (`Goddy36-A/vela-ai`) to Render.
2. Render will automatically detect the `render.yaml` configuration file.
3. Configure the required environment variables in the Render dashboard:
   - `DATABASE_URL`: Your MySQL connection string.
   - `GITHUB_PAT`: Your GitHub Personal Access Token.
   - `BUILT_IN_FORGE_API_KEY`: Your AI proxy API key (if using the built-in LLM gateway).
4. Click **Deploy**. Render will run `pnpm install && pnpm build` and start the server using `pnpm start`.

Note: If your Render instance runs headlessly without pre-installed Chromium binaries, Playwright will automatically fall back to search synthesis or require a custom Render Dockerfile with Chromium dependencies.
