import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialAuth } from "@/components/auth/social-auth";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create an account — AI Studio", description: "Create your AI Studio workspace." };

export default function SignUpPage() {
  return <AuthShell eyebrow="YOUR NEXT CHAPTER" title="Start with an idea." description="Create a workspace for everything you’re ready to make.">
    <SocialAuth />
    <div className="auth-divider"><span />or sign up with email<span /></div>
    <SignUpForm />
  </AuthShell>;
}
