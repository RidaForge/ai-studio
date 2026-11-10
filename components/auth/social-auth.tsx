"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Code2, LoaderCircle } from "lucide-react";
import { createClient } from "@insforge/sdk";
import { startOAuthAction } from "@/lib/auth/actions";

type Provider = "google" | "github";

function subscribeLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getAuthError() {
  return new URLSearchParams(window.location.search).get("auth_error");
}

function getServerAuthError() {
  return null;
}

function OAuthSubmitButton({ provider }: { provider: Provider }) {
  const { pending } = useFormStatus();
  const isGoogle = provider === "google";
  return <button className="social-button" type="submit" disabled={pending} aria-busy={pending}>
    {isGoogle ? <span className="google-g" aria-hidden="true">G</span> : <Code2 size={17} aria-hidden="true" />}
    <span>{pending ? "Connecting…" : `Continue with ${isGoogle ? "Google" : "GitHub"}`}</span>
  </button>;
}

export function SocialAuth() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const authError = useSyncExternalStore(subscribeLocation, getAuthError, getServerAuthError);

  useEffect(() => {
    let active = true;
    const client = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    });
    void client.auth.getPublicAuthConfig().then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        setConfigError(true);
      } else {
        setProviders(data.oAuthProviders.filter((provider): provider is Provider => provider === "google" || provider === "github"));
      }
      setLoading(false);
    }).catch(() => {
      if (active) {
        setConfigError(true);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  return <div className="social-stack">
    {authError && <div className="inline-alert error-alert" role="alert">{authError === "signout" ? "We couldn't fully sign you out. Please try again." : "We couldn't complete that sign-in. Please try again or use email."}</div>}
    {loading && <div className="provider-loading" role="status"><LoaderCircle size={15} className="loading-spinner" /> Checking available sign-in options…</div>}
    {!loading && providers.includes("google") && <form action={startOAuthAction}><input type="hidden" name="provider" value="google" /><OAuthSubmitButton provider="google" /></form>}
    {!loading && providers.includes("github") && <form action={startOAuthAction}><input type="hidden" name="provider" value="github" /><OAuthSubmitButton provider="github" /></form>}
    {!loading && providers.length === 0 && <div className="provider-pending" role={configError ? "status" : "note"}>{configError ? "Social sign-in options are temporarily unavailable. Use email to continue." : "Email sign-in is available for this project."}</div>}
  </div>;
}
