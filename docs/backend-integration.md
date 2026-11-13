# InsForge integration handoff

## Authentication status

Authentication is connected to InsForge through the documented Next.js SSR helpers in `@insforge/sdk@1.5.2`. The app uses server auth actions, an OAuth callback, refresh route, Next.js 16 `proxy.ts` session refresh, and a server-protected `/` workspace. No auth tokens or admin API keys are returned to client code.

Implemented routes: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/api/auth/callback`, and `/api/auth/refresh`.

The linked isolated branch reports Google and GitHub enabled, email verification by 6-digit code, password reset by 6-digit code, minimum password length 6, and signup enabled. Only enabled Google/GitHub providers render. The branch allowlist includes `http://localhost:3000/api/auth/callback`.

## Branch and environment

The linked CLI project is the isolated `ai-studio-auth` branch. `.env.local` has been checked against that branch: the project URL, anon key, and local app URL match; secret values are intentionally not recorded here. Restart any existing Next.js dev server so it reloads `.env.local`.

Only the public anon key is used by user-scoped SSR clients. Never put the InsForge admin API key in browser code or `NEXT_PUBLIC_*` variables.

## Authentication implementation notes

- Auth mutations use `createAuthActions()` from `@insforge/sdk/ssr`; request-time clients use `createServerClient()` and the browser provider discovery uses `createBrowserClient()`.
- Sign-up uses the SDK result’s `requireEmailVerification` and follows it with `verifyEmail({ email, otp })`. Resend uses `resendVerificationEmail({ email })`.
- Sign-in and sign-out use `signInWithPassword({ email, password })` and `signOut()`.
- OAuth uses `signInWithOAuth(provider, { redirectTo, skipBrowserRedirect: true })`, an httpOnly verifier cookie, `/api/auth/callback`, and `exchangeOAuthCode(code, verifier)`.
- Password recovery uses `sendResetPasswordEmail({ email })`, `exchangeResetPasswordToken({ email, code })`, and `resetPassword({ newPassword, otp: token })`.
- The installed SDK type declarations were checked for these signatures before implementation. Token-bearing responses are stripped by `createAuthActions()` or consumed only within the server action.

## Remaining manual authentication checks

The branch’s public config and local callback configuration were verified, and both provider OAuth initiation calls return an authorization URL plus verifier. Full Google/GitHub authorization and callback exchange still need a browser account and provider-console settings to be exercised. Signup verification and successful password reset need an inbox with the 6-digit email codes. No test user was created and no real user password was changed.

Confirm the OAuth client credentials are active in InsForge, and that the Google/GitHub developer consoles use InsForge’s provider callback URL shown in the InsForge dashboard. For deployment, add the deployed app callback URL to InsForge’s `allowed_redirect_urls` and set `NEXT_PUBLIC_APP_URL` to the deployed origin.

## AI avatars and saved history status

The separate AI Avatars feature is implemented in `app/dashboard/avatar/` and `components/workspace/avatar-studio.tsx`. It uses authenticated routes under `app/api/avatars/`, the `public.avatars` table, the required private `avatars` Storage bucket, and the Trigger.dev task in `trigger/generate-avatar.ts`. Its task calls Cloudflare Workers AI's FLUX.2 Klein 4B model separately for 1024x576 and 576x1024 outputs, resizing the private source image to fit under 512x512 first.

The migration source is `migrations/20261111120000_create-avatars.sql`. It defines owner-only row policies and bucket-scoped storage-object policies. The migration does not create the Storage bucket; inspect the linked InsForge project, apply the migration if needed, and ensure `avatars` exists as a private bucket. Setup commands and required environment variable names are documented in `docs/ai-avatars-setup.md`.

These are source-code facts, not proof of a successful runtime generation. Authentication, migration state, bucket privacy, Trigger.dev Development environment variables, Cloudflare generation, signed image access, and realtime progress require runtime verification against the intended services. The general Studio generation and history described earlier in this file remain pending and are separate from AI Avatars.
