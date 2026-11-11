"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Eye, LockKeyhole, Mail } from "lucide-react";
import { signInAction, type AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = { status: "idle" };

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return <>
    {state.status === "error" && <div className="inline-alert error-alert" role="alert">{state.message}</div>}
    <form className="auth-form" action={action}>
      <label className="field-label" htmlFor="email">Email address</label>
      <div className="input-wrap"><Mail size={17} aria-hidden="true" /><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
      <div className="password-label-row"><label className="field-label" htmlFor="password">Password</label><Link href="/forgot-password">Forgot password?</Link></div>
      <div className="input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /><Eye size={17} className="input-action-icon" aria-hidden="true" /></div>
      <button className="primary-button auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Signing in…" : <>Sign in <span aria-hidden="true">→</span></>}</button>
    </form>
    <div className="auth-switch">New to AI Studio? <Link href="/sign-up">Create an account <span aria-hidden="true">↗</span></Link></div>
  </>;
}
