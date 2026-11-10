import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Sparkles } from "lucide-react";
import type { WorkspaceDestination } from "@/components/workspace/workspace-data";

export function FeaturePlaceholder({ destination }: { destination: WorkspaceDestination }) {
  const Icon = destination.icon;

  return (
    <section className="destination-page">
      <Link className="destination-back" href="/"><ArrowLeft size={15} /> Back to Home</Link>
      <div className="destination-panel">
        <div className="destination-art" aria-hidden="true">
          <span className="destination-orbit destination-orbit-one" />
          <span className="destination-orbit destination-orbit-two" />
          <span className="destination-icon"><Icon size={31} strokeWidth={1.6} /></span>
          <span className="destination-spark destination-spark-one"><Sparkles size={15} /></span>
          <span className="destination-spark destination-spark-two"><Sparkles size={11} /></span>
        </div>
        <span className="dashboard-eyebrow"><Sparkles size={13} /> COMING SOON</span>
        <h1>{destination.label}</h1>
        <p>{destination.description} We’re putting the finishing touches on this experience.</p>
        <Link className="destination-home-link" href="/">Explore your creative toolkit <ArrowUpRight size={15} /></Link>
      </div>
    </section>
  );
}
