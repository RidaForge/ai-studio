import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = { title: "Choose a new password — AI Studio" };

async function ResetPasswordContent({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const { email: emailParam = "" } = await searchParams;
  const email = Array.isArray(emailParam) ? emailParam[0] ?? "" : emailParam;
  return <ResetPasswordForm initialEmail={email} />;
}

export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return <AuthShell eyebrow="ACCOUNT RECOVERY" title="Choose a new password." description="Make it something strong and easy for you to remember.">
    <Suspense fallback={<div className="provider-loading" role="status">Preparing the secure reset form…</div>}><ResetPasswordContent searchParams={props.searchParams} /></Suspense>
  </AuthShell>;
}
