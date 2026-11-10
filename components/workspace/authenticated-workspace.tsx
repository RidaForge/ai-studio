import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/workspace/dashboard-shell";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export function WorkspaceFallback() {
  return <main className="session-loading" role="status"><span className="pending-ring" aria-hidden="true" />Preparing your workspace…</main>;
}

export async function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  await connection();
  const client = await createInsForgeServerClient();
  const { data, error } = await client.auth.getCurrentUser();

  if (error || !data?.user) redirect("/sign-in");

  return <DashboardShell user={{ email: data.user.email, name: data.user.profile?.name ?? null }}>{children}</DashboardShell>;
}
