import { updateSession } from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { insforgeAuthCookieNames } from "@/lib/insforge/auth-cookies";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
    names: insforgeAuthCookieNames,
  });
  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
