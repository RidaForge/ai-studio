import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";
import { createServerClient } from "@insforge/sdk/ssr";
import { syncUserProfile } from "@/lib/auth/user-profile";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const destination = oauthError || !code ? "/sign-in?auth_error=oauth" : "/";
  const response = NextResponse.redirect(new URL(destination, request.url));

  if (oauthError || !code) {
    response.cookies.delete("insforge_code_verifier");
    return response;
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("insforge_code_verifier")?.value;
  if (!codeVerifier) {
    response.cookies.delete("insforge_code_verifier");
    response.headers.set("Location", new URL("/sign-in?auth_error=verifier", request.url).toString());
    return response;
  }

  const auth = createAuthActions({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });
  const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier);
  response.cookies.delete("insforge_code_verifier");
  if (error || !data?.user) {
    response.headers.set("Location", new URL("/sign-in?auth_error=exchange", request.url).toString());
  } else {
    const profileError = await syncUserProfile(
      createServerClient({ accessToken: response.cookies.get("insforge_access_token")?.value }),
      data.user,
    );
    if (profileError) {
      response.headers.set("Location", new URL("/sign-in?auth_error=profile", request.url).toString());
    }
  }
  return response;
}
