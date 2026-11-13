import { createRefreshAuthRouter } from "@insforge/sdk/ssr";
import { insforgeAuthCookieNames } from "@/lib/insforge/auth-cookies";

export const { POST } = createRefreshAuthRouter({ names: insforgeAuthCookieNames });
