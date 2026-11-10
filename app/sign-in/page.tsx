import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialAuth } from "@/components/auth/social-auth";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in — AI Studio", description: "Sign in to your AI Studio workspace." };

export default function SignInPage() {
  return <AuthShell eyebrow="WELCOME BACK" title="Good to see you." description="Sign in to pick up where your ideas left off.">
    <SocialAuth />
    <div className="auth-divider"><span />or sign in with email<span /></div>
    <SignInForm />
  </AuthShell>;
}
