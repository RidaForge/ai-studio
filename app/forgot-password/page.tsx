import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = { title: "Reset your password — AI Studio" };

export default function ForgotPasswordPage() {
  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="Let’s get you back in." description="Enter the email linked to your account and we’ll send reset instructions.">
    <ForgotPasswordForm />
  </AuthShell>;
}
