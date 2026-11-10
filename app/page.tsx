import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/workspace/dashboard";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export const metadata: Metadata = {
  title: "AI Studio — Create at your pace",
  description: "A thoughtful workspace for turning ideas into text and images.",
};

function SessionFallback() {
  return <main className="session-loading" role="status"><span className="pending-ring" aria-hidden="true" />Preparing your workspace…</main>;
}

async function AuthenticatedDashboard() {
  await connection();
  const client = await createInsForgeServerClient();
  const { data, error } = await client.auth.getCurrentUser();
  if (error || !data?.user) redirect("/sign-in");
  return <Dashboard user={{ email: data.user.email, name: data.user.profile?.name ?? null }} />;
}

export default function Home() {
  return <Suspense fallback={<SessionFallback />}><AuthenticatedDashboard /></Suspense>;
}
