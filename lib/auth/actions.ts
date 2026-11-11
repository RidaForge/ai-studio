"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { syncUserProfile } from "@/lib/auth/user-profile";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  email?: string;
};

const idle: AuthFormState = { status: "idle" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const otpPattern = /^\d{6}$/;
const pendingVerificationCookie = "pending_insforge_email_verification";
const pendingVerificationMaxAge = 24 * 60 * 60;

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function errorState(message: string): AuthFormState {
  return { status: "error", message };
}

function setPendingVerificationCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, email: string) {
  cookieStore.set(pendingVerificationCookie, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: pendingVerificationMaxAge,
  });
}

function getAppOrigin() {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
  return new URL(origin).origin;
}

export async function signInAction(_state: AuthFormState = idle, formData: FormData): Promise<AuthFormState> {
  void _state;
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  if (!emailPattern.test(email) || !password) return errorState("Enter a valid email address and password.");

  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error?.error === "AUTH_NEED_VERIFICATION") {
    setPendingVerificationCookie(cookieStore, email);
    redirect("/verify-email");
  }
  if (error || !data?.user) return errorState(error?.message ?? "We couldn't sign you in. Check your details and try again.");
  const profileError = await syncUserProfile(createServerClient({ cookies: cookieStore }), data.user);
  if (profileError) return errorState("You are signed in, but we couldn't save your user profile. Please try again.");
  redirect("/");
}

export async function signUpAction(_state: AuthFormState = idle, formData: FormData): Promise<AuthFormState> {
  void _state;
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  if (!name || name.length > 100) return errorState("Enter your name (up to 100 characters).");
  if (!emailPattern.test(email)) return errorState("Enter a valid email address.");
  if (password.length < 6) return errorState("Your password must be at least 6 characters.");

  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signUp({ email, password, name });
  if (error || !data) return errorState(error?.message ?? "We couldn't create your account. Please try again.");

  // The SDK response field is optional. Also honor the project's public auth
  // setting, since it is the source of truth when the response omits the flag.
  let verificationRequired = data.requireEmailVerification === true || data.user?.emailVerified === false;
  if (!verificationRequired) {
    const { data: authConfig } = await createServerClient({ cookies: cookieStore }).auth.getPublicAuthConfig();
    verificationRequired = authConfig?.requireEmailVerification === true;
  }

  if (verificationRequired || data.user?.emailVerified === false || !data.user) {
    setPendingVerificationCookie(cookieStore, email);
    redirect("/verify-email");
  }

  if (!data.user) return errorState("Your account was created, but we couldn't confirm its status. Try signing in or contact support.");
  const profileError = await syncUserProfile(createServerClient({ cookies: cookieStore }), data.user, name);
  if (profileError) return errorState("Your account was created, but we couldn't save your user profile. Please sign in again to retry.");
  cookieStore.delete(pendingVerificationCookie);
  redirect("/");
}

export async function verifyEmailAction(_state: AuthFormState = idle, formData: FormData): Promise<AuthFormState> {
  void _state;
  const email = (await cookies()).get(pendingVerificationCookie)?.value ?? "";
  const otp = value(formData, "otp");
  if (!emailPattern.test(email)) return errorState("Enter a valid email address.");
  if (!otpPattern.test(otp)) return errorState("Enter the 6-digit code from your email.");

  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.verifyEmail({ email, otp });
  if (error) {
    if (error.statusCode === 400 || error.statusCode === 401) {
      return errorState("That code is invalid or expired. Request a new code and try again.");
    }
    return errorState(error.message || "We couldn't verify that code. Please try again.");
  }
  if (!data?.user) return errorState("InsForge could not confirm the code. Request a new code and try again.");
  const profileError = await syncUserProfile(createServerClient({ cookies: await cookies() }), data.user);
  if (profileError) return errorState("Your email is verified, but we couldn't save your user profile. Please sign in to retry.");
  (await cookies()).delete(pendingVerificationCookie);
  redirect("/");
}

export async function resendVerificationAction(_state: AuthFormState = idle, formData: FormData): Promise<AuthFormState> {
  void _state;
  const cookieStore = await cookies();
  const email = (cookieStore.get(pendingVerificationCookie)?.value || value(formData, "email")).toLowerCase();
  if (!emailPattern.test(email)) return errorState("Enter a valid email address.");
  const client = createServerClient({ cookies: cookieStore });
  const { data, error } = await client.auth.resendVerificationEmail({ email });
  if (error) {
    if (error.statusCode === 429) return errorState("Too many resend attempts. Wait a few minutes before requesting another code.");
    return errorState(error.message || "InsForge couldn't accept the resend request. Please try again.");
  }
  if (!data?.success) return errorState(data?.message || "InsForge did not accept the resend request. Please try again.");

  setPendingVerificationCookie(cookieStore, email);
  return {
    status: "success",
    email,
    message: "InsForge accepted the resend request. Check your inbox for the newest code; earlier codes may be expired.",
  };
}

export async function signOutAction() {
  const auth = createAuthActions({ cookies: await cookies() });
  const { error } = await auth.signOut();
  if (error) redirect("/sign-in?auth_error=signout");
  redirect("/sign-in");
}

export async function startOAuthAction(formData: FormData): Promise<void> {
  const provider = value(formData, "provider");
  if (provider !== "google" && provider !== "github") redirect("/sign-in?auth_error=provider");

  const client = createServerClient({ cookies: await cookies() });
  const { data: config, error: configError } = await client.auth.getPublicAuthConfig();
  if (configError || !config?.oAuthProviders.includes(provider)) redirect("/sign-in?auth_error=provider");

  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signInWithOAuth(provider, {
    redirectTo: new URL("/api/auth/callback", getAppOrigin()).toString(),
    skipBrowserRedirect: true,
  });
  if (error || !data.url || !data.codeVerifier) redirect("/sign-in?auth_error=oauth");

  cookieStore.set("insforge_code_verifier", data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  redirect(data.url);
}

export async function sendResetPasswordAction(_state: AuthFormState = idle, formData: FormData): Promise<AuthFormState> {
  void _state;
  const email = value(formData, "email").toLowerCase();
  if (!emailPattern.test(email)) return errorState("Enter a valid email address.");
  const client = createServerClient({ cookies: await cookies() });
  const { data, error } = await client.auth.sendResetPasswordEmail({ email });
  if (error || !data?.success) return errorState(error?.message ?? "We couldn't send reset instructions. Please try again.");
  return { status: "success", email, message: "If an account exists for that email, a 6-digit reset code is on its way." };
}

export async function resetPasswordAction(_state: AuthFormState = idle, formData: FormData): Promise<AuthFormState> {
  void _state;
  const email = value(formData, "email").toLowerCase();
  const code = value(formData, "code");
  const password = value(formData, "password");
  const confirmPassword = value(formData, "confirmPassword");
  if (!emailPattern.test(email)) return errorState("Enter the email address associated with your account.");
  if (!otpPattern.test(code)) return errorState("Enter the 6-digit reset code from your email.");
  if (password.length < 6) return errorState("Your new password must be at least 6 characters.");
  if (password !== confirmPassword) return errorState("The passwords don't match.");

  const client = createServerClient({ cookies: await cookies() });
  const { data: reset, error: exchangeError } = await client.auth.exchangeResetPasswordToken({ email, code });
  if (exchangeError || !reset?.token) return errorState(exchangeError?.message ?? "That code couldn't be verified. Request a fresh reset code.");
  const { error } = await client.auth.resetPassword({ newPassword: password, otp: reset.token });
  if (error) return errorState(error.message ?? "We couldn't update your password. Please try again.");
  return { status: "success", email, message: "Your password has been updated. You can sign in with it now." };
}
