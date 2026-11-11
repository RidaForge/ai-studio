import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { VerificationRecoveryForm } from "@/components/auth/verification-recovery-form";

export const metadata: Metadata = { title: "Verify your email — AI Studio", description: "Verify your email to finish creating your AI Studio workspace." };

async function VerifyEmailContent() {
  await connection();
  const email = (await cookies()).get("pending_insforge_email_verification")?.value;
  if (!email) {
    return <AuthShell eyebrow="EMAIL VERIFICATION" title="Request a fresh code." description="Enter the email you used to sign up. We’ll ask InsForge to resend a verification code if one is needed.">
      <VerificationRecoveryForm />
    </AuthShell>;
  }

  return <AuthShell eyebrow="ONE LAST STEP" title="Check your inbox." description="Enter the 6-digit code we sent to finish setting up your workspace.">
    <VerifyEmailForm email={email} />
  </AuthShell>;
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="session-loading" role="status"><span className="pending-ring" aria-hidden="true" />Preparing your verification…</main>}><VerifyEmailContent /></Suspense>;
}
