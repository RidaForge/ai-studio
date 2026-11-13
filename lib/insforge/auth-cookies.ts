import type { AuthCookieNames } from "@insforge/sdk/ssr";

const backendHost = process.env.NEXT_PUBLIC_INSFORGE_URL
  ? new URL(process.env.NEXT_PUBLIC_INSFORGE_URL).hostname.toLowerCase().replace(/[^a-z0-9]/g, "_")
  : "default";

// Separate sessions across InsForge projects and branches on the same app origin.
export const insforgeAuthCookieNames: Required<AuthCookieNames> = {
  accessToken: `insforge_access_token_${backendHost}`,
  refreshToken: `insforge_refresh_token_${backendHost}`,
};
