"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, LockKeyhole, Mail } from "lucide-react";
import { resetPasswordAction, sendResetPasswordAction, type AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(sendResetPasswordAction, initialState);

  return <>
    {state.message && <div className={`inline-alert ${state.status === "error" ? "error-alert" : "success-alert"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</div>}
    {state.status !== "success" && <form className="auth-form" action={action}>
      <label className="field-label" htmlFor="email">Email address</label>
      <div className="input-wrap"><Mail size={17} aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
      <button className="primary-button auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Sending code…" : <>Send reset code <span aria-hidden="true">→</span></>}</button>
    </form>}
    {state.status === "success" && <Link className="primary-button auth-submit auth-link-button" href={`/reset-password?email=${encodeURIComponent(state.email ?? "")}`}>Continue to reset password <span aria-hidden="true">→</span></Link>}
    <div className="auth-switch"><Link href="/sign-in">← Back to sign in</Link></div>
  </>;
}

export function ResetPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  return <>
    {state.message && <div className={`inline-alert ${state.status === "error" ? "error-alert" : "success-alert"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</div>}
    {state.status === "success" ? <div className="auth-form"><Link className="primary-button auth-submit auth-link-button" href="/sign-in">Sign in with your new password <span aria-hidden="true">→</span></Link></div> : <form className="auth-form" action={action}>
      <label className="field-label" htmlFor="email">Email address</label>
      <div className="input-wrap"><Mail size={17} aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" defaultValue={initialEmail} placeholder="you@example.com" required /></div>
      <label className="field-label" htmlFor="code">6-digit reset code</label>
      <div className="input-wrap"><KeyRound size={17} aria-hidden="true" /><input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required /></div>
      <label className="field-label" htmlFor="password">New password <span className="field-hint">At least 6 characters</span></label>
      <div className="input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="password" name="password" type="password" autoComplete="new-password" minLength={6} placeholder="Choose a new password" required /></div>
      <label className="field-label" htmlFor="confirmPassword">Confirm new password</label>
      <div className="input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} placeholder="Enter your new password again" required /></div>
      <button className="primary-button auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Updating password…" : <>Update password <span aria-hidden="true">→</span></>}</button>
    </form>}
    <div className="auth-switch"><Link href="/forgot-password">Request another reset code</Link></div>
  </>;
}
