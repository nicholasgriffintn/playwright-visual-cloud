# playwright-visual-cloud

An open source, Chromatic-style platform for self-hosted, visual snapshot testing in Playwright, running entirely on your Cloudflare account.

This includes an NPM package that provides a matcher for use in your Playwright tests alongside your own backend for hosting images alongside metadata about builds, snapshots and baselines.

On top of the backend, this also ships a UI to browser builds, inspect diffs and approve changes with build in CI gating workflows that ensure approval is required before a merge when a diff occurs.

Comparison runs client-side in the test process (pixelmatch), so the Worker stays cheap and stateless — it only stores, serves, and reviews.

## Development

Create a GitHub OAuth app with this callback URL:

```text
http://localhost:8787/api/auth/github/callback
```

Add `apps/website/.dev.vars`:

```dotenv
SITE_ORIGIN=http://localhost:8787
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

Run the following:

```bash
pnpm install
pnpm --dir apps/website migrate:local
pnpm dev
```

## Deployment

Create the Cloudflare resources, copy the D1 database ID into
`apps/website/wrangler.json`, and update its `SITE_ORIGIN` value:

```bash
pnpm --dir apps/website exec wrangler d1 create pvc
pnpm --dir apps/website exec wrangler r2 bucket create pvc-images
pnpm --dir apps/website exec wrangler secret put GITHUB_CLIENT_ID
pnpm --dir apps/website exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm --dir apps/website migrate
pnpm build
pnpm deploy
```

Use your deployed callback URL in the production GitHub OAuth app.

## Usage

Create a project and project token in the dashboard, then install the client:

```bash
pnpm add playwright-visual-cloud
```

```ts
import { test } from "@playwright/test";
import { expect } from "playwright-visual-cloud";

test("homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page).toMatchVisualSnapshot("homepage", { fullPage: true });
});
```

Set `PVC_SERVER_URL` and `PVC_TOKEN` in CI. Add the reporter to
`playwright.config.ts` for build summaries and review links:

```ts
reporter: [["list"], ["playwright-visual-cloud/reporter"]],
```

See [the example GitHub Actions workflow](examples/.github/workflows/visual-tests.yml)
for a complete CI setup.
