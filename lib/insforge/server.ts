import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";
import { insforgeAuthCookieNames } from "@/lib/insforge/auth-cookies";

export async function createInsForgeServerClient() {
  return createServerClient({ cookies: await cookies(), names: insforgeAuthCookieNames });
}
