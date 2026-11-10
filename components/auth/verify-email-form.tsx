"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Mail } from "lucide-react";
import { resendVerificationAction, verifyEmailAction, type AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = { status: "idle" };

export function VerifyEmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, initialState);
  const [resendState, resendAction, resending] = useActionState(resendVerificationAction, initialState);
  const otpInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendState.status === "success" && otpInput.current) otpInput.current.value = "";
  }, [resendState]);

  return <>
    <div className="verification-email-note"><Mail size={16} aria-hidden="true" /><span>Verification email for <strong>{email}</strong></span></div>
    {state.status === "error" && <div className="inline-alert error-alert" role="alert">{state.message}</div>}
    {resendState.message && <div className={`inline-alert ${resendState.status === "error" ? "error-alert" : "success-alert"}`} role={resendState.status === "error" ? "alert" : "status"}>{resendState.message}</div>}
    <form className="auth-form" action={action}>
      <label className="field-label" htmlFor="otp">6-digit verification code</label>
      <div className="input-wrap otp-input-wrap"><input ref={otpInput} id="otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" aria-label="6-digit verification code" required /></div>
      <button className="primary-button auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Verifying…" : <>Verify email <span aria-hidden="true">→</span></>}</button>
    </form>
    <form className="resend-form" action={resendAction}>
      <button className="text-button" type="submit" disabled={resending} aria-busy={resending}>{resending ? "Sending…" : "Resend verification code"}</button>
    </form>
    <div className="auth-switch"><Link href="/sign-up">Use a different email</Link></div>
  </>;
}
