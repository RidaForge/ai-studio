# AI avatars setup

## Dependencies

The project already includes the Trigger.dev v4 SDK/build packages and Sharp for reference-image resizing. Run `npm install` after checking out the project to install the lockfile dependencies.

```powershell
npm install
```

## Environment

Keep these names in `.env.local` for the Next.js app and local development. Do not print or commit their values:

- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` — server-only credentials for Workers AI FLUX.2 Klein 4B.
- `INSFORGE_API_KEY` — InsForge project API key used only by the trusted Trigger task to read and save avatar files and rows.
- `NEXT_PUBLIC_INSFORGE_URL` — InsForge project URL.
- `NEXT_PUBLIC_INSFORGE_ANON_KEY` — public key used by authenticated user-scoped app clients.
- `TRIGGER_PROJECT_REF` and `TRIGGER_SECRET_KEY` — Trigger.dev project reference and server API key.

Do not expose `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `INSFORGE_API_KEY`, or `TRIGGER_SECRET_KEY` as `NEXT_PUBLIC_*` variables.

## InsForge backend

The migration at `migrations/20261111120000_create-avatars.sql` creates `public.avatars`, an owner-and-created-time index, owner-only row policies, the timestamp trigger, and bucket-scoped owner policies for `storage.objects`. The migration does not provision the Storage bucket, and the repository does not prove whether the migration has been applied. Check the linked project and migration order before applying it:

```powershell
npx -y @insforge/cli db migrations list
npx -y @insforge/cli db migrations up 20261111120000_create-avatars.sql
```

The `avatars` Storage bucket must exist and be private because reference photos and generated avatars are personal. Bucket provisioning is manual. Check its current state first:

```powershell
npx -y @insforge/cli storage buckets
npx -y @insforge/cli storage create-bucket avatars --private
```

If the bucket already exists, confirm it is private and do not create a duplicate. The migration's storage policies scope reads, inserts, updates, and deletes to keys whose first path segment is the authenticated user's ID.

## Trigger.dev

Start the task worker locally with the project env file after setting its environment variables:

```powershell
npm run trigger:dev
```

The `trigger:dev` script explicitly passes the project-root `.env.local` using Trigger.dev 4.8.4's `--env-file` option. The local task-run process receives those values; `trigger.config.ts` separately loads the file so the CLI can read `TRIGGER_PROJECT_REF` while evaluating its config. The local task needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `INSFORGE_API_KEY`, and `NEXT_PUBLIC_INSFORGE_URL`. For runs outside the local worker, configure the required values as secrets in the matching Trigger.dev environment. `NEXT_PUBLIC_INSFORGE_ANON_KEY` is used by the app's user-scoped clients, while `TRIGGER_PROJECT_REF` and the app's `TRIGGER_SECRET_KEY` are needed for local CLI/app integration. Task startup logs only whether the two Cloudflare variables are present, never their values.

The app routes are `/dashboard/avatar`, `GET /api/avatars`, `POST /api/avatars/upload`, and `POST /api/avatars/generate`. The generation endpoint returns `avatarId`, `runId`, and `publicAccessToken`; the `generate-ai-avatar` task stores source and generated files in the private `avatars` bucket and updates the matching `public.avatars` row. This describes the implementation; successful runtime integration still requires an actual authenticated run.

Deploy registered tasks with:

```powershell
npm run trigger:deploy
```
