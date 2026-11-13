import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthenticatedWorkspace, WorkspaceFallback } from "@/components/workspace/authenticated-workspace";
import { FeaturePlaceholder } from "@/components/workspace/feature-placeholder";
import { allDestinations } from "@/components/workspace/workspace-data";

export function generateStaticParams() {
  return [...allDestinations, {
    slug: "billing-settings",
    label: "User billing settings",
    description: "Manage your billing details and plan.",
  }].map(({ slug }) => ({ section: slug }));
}

export default async function WorkspaceDestinationPage({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  if (section === "avatar") redirect("/dashboard/avatar");
  const destination = section === "billing-settings"
    ? { slug: section, label: "User billing settings", description: "Manage your billing details and plan.", icon: allDestinations[0].icon }
    : allDestinations.find((item) => item.slug === section);

  if (!destination) notFound();

  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <AuthenticatedWorkspace><FeaturePlaceholder destination={destination} /></AuthenticatedWorkspace>
    </Suspense>
  );
}
