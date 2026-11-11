import { Suspense } from "react";
import { DashboardHome } from "@/components/workspace/dashboard-home";
import { AuthenticatedWorkspace, WorkspaceFallback } from "@/components/workspace/authenticated-workspace";

export default function HomePage() {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <AuthenticatedWorkspace><DashboardHome /></AuthenticatedWorkspace>
    </Suspense>
  );
}
