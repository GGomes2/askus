# Askwell

Phase 0 application scaffold. The home page imports `APP_NAME` from `@askwell/shared`.

## Local setup

Use Node.js 24 LTS (see `.node-version`) and the exact pnpm version in `package.json`.
Install pnpm with `npm install --global pnpm@12.18.0` using that pinned version, then run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. The dev server listens on `0.0.0.0`; sandbox access from a host may require publishing port 3000.
No application-service credentials or environment file are needed for the scaffold or its checks.
`.env.example` documents future configuration; keep real values outside Git. In HQ, add variables through Settings → Sandbox → App variables and restart the worker.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Vitest explicitly permits no tests: this scaffold has no routes or pure functions with behavior to test yet. Add meaningful tests with later features.

## Workspaces

- `apps/web`: Next.js App Router and Tailwind CSS.
- `apps/widget`: buildable vanilla TypeScript placeholder, bundled to `dist/widget.js`; no widget behavior yet.
- `packages/shared`: shared app name; API contracts and plan limits come in Phase 1.
- `packages/db`: buildable empty module; no clients, schema, migrations or fabricated generated types. Database type generation tooling comes with Phase 1.

Root checks cover all workspaces. Workspace dependencies use `workspace:*`; Next.js transpiles the shared TypeScript source. Root build compiles packages before building web.

## Vercel monorepo setup

The product owner imports `GGomes2/askus` into Vercel and configures:

1. Framework: Next.js. Root Directory: `apps/web`. Enable inclusion of source files outside the root directory.
2. Node.js: 24.x. Install command: `cd ../.. && pnpm install --frozen-lockfile`.
3. Build command: `cd ../.. && pnpm build`. Leave the Next.js output directory at its default.
4. Git PR previews enabled. Production branch: `main`. Turn **automatic production promotion off** before deployment. Only the product owner merges and promotes production.
5. Enable preview protection. Add `VERCEL_AUTOMATION_BYPASS_SECRET` to Dwight's App variables in HQ (Settings → Sandbox → App variables), then restart Dwight. This is a local verification secret, never a `NEXT_PUBLIC_*` variable.

Preview and Development will use the shared Supabase dev project in later phases; Production uses its separate project. Phase 0 needs no service variables on Vercel.

Vercel detects Next.js from `apps/web/package.json`. If the build log reports `NEXT_NO_VERSION` after pnpm successfully installs the workspace, check that Root Directory is set to `apps/web` and that Vercel includes source files outside that directory so it can access the workspace lockfile and shared package.

After opening the PR, obtain the successful preview URL from its Vercel comment or GitHub deployment status. Send `x-vercel-protection-bypass` with the automation secret on every protected request, and `x-vercel-set-bypass-cookie: true` on the initial browser request. Never log the secret. Confirm that `/` returns HTTP 200, the browser renders the Askwell page title and heading without console errors, and the page has no horizontal overflow at a mobile viewport. Record the preview URL, commit SHA, and check results in the PR. Allow `*.vercel.app` through HQ if blocked.
