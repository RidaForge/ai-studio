import { Suspense } from "react";
import { AuthenticatedWorkspace, WorkspaceFallback } from "@/components/workspace/authenticated-workspace";
import { AvatarStudio } from "@/components/workspace/avatar-studio";

export default function AvatarPage() {
  return <Suspense fallback={<WorkspaceFallback />}>
    <AuthenticatedWorkspace><AvatarStudio /></AuthenticatedWorkspace>
  </Suspense>;
}
