"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { resendVerificationAction, type AuthFormState } from "@/lib/auth/actions";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

const initialState: AuthFormState = { status: "idle" };

export function VerificationRecoveryForm() {
  const [state, action, pending] = useActionState(resendVerificationAction, initialState);

  if (state.status === "success" && state.email) {
    return <>
      <div className="inline-alert success-alert" role="status">{state.message}</div>
      <VerifyEmailForm email={state.email} />
    </>;
  }

  return <>
    {state.status === "error" && <div className="inline-alert error-alert" role="alert">{state.message}</div>}
    <form className="auth-form" action={action}>
      <label className="field-label" htmlFor="verification-email">Email address</label>
      <div className="input-wrap"><Mail size={17} aria-hidden="true" /><input id="verification-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
      <button className="primary-button auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Requesting code…" : <>Resend verification code <span aria-hidden="true">→</span></>}</button>
    </form>
  </>;
}
