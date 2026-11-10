"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { signUpAction, type AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = { status: "idle" };

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initialState);

  return <>
    {state.status === "error" && <div className="inline-alert error-alert" role="alert">{state.message}</div>}
    <form className="auth-form" action={action}>
      <label className="field-label" htmlFor="name">Your name</label>
      <div className="input-wrap"><UserRound size={17} aria-hidden="true" /><input id="name" name="name" type="text" autoComplete="name" placeholder="Alex Morgan" maxLength={100} required /></div>
      <label className="field-label" htmlFor="email">Email address</label>
      <div className="input-wrap"><Mail size={17} aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
      <label className="field-label" htmlFor="password">Password <span className="field-hint">At least 6 characters</span></label>
      <div className="input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" minLength={6} required /></div>
      <button className="primary-button auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Creating account…" : <>Create account <span aria-hidden="true">→</span></>}</button>
    </form>
    <div className="auth-switch">Already have an account? <Link href="/sign-in">Sign in <span aria-hidden="true">↗</span></Link><span aria-hidden="true"> · </span><Link href="/verify-email">Verify Email</Link></div>
  </>;
}
