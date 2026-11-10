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

## AI generation and saved history status

These features remain visibly pending; no fake model response, upload, database row, or history is produced. To enable them:

1. Install an OpenRouter-compatible client only if needed for the chosen server implementation (for example, `npm install --save-exact openai@7.53.0`). Keep `OPENROUTER_API_KEY` server-only.
2. Run `npx -y @insforge/cli ai setup` against the intended backend branch and discover currently available text/image models before choosing IDs.
3. Add a reviewed migration for an owner-scoped `public.generations` table with RLS using `auth.uid()`.
4. Create a private `generated-assets` Storage bucket and owner path RLS for `storage.objects`; store both uploaded `url` and `key` with each generation.
5. Add and verify an authenticated generation route for text and image modes, then test RLS and history with two user accounts before enabling the Generate button.
