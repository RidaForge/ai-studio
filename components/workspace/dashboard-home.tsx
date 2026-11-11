import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { allDestinations } from "@/components/workspace/workspace-data";

const mediaBySlug: Record<string, { src: string; type: "video" | "image" }> = {
  "ai-video-agent": { src: "/ai-video-agent.mp4", type: "video" },
  "ai-video-avatar": { src: "/ai-avatar.mp4", type: "video" },
  avatar: { src: "/avatar.mp4", type: "video" },
  "ai-voice-cloning": { src: "/voice-cloning.jpg", type: "image" },
  "my-library": { src: "/ai-video-agent.mp4", type: "video" },
};

export function DashboardHome() {
  return (
    <div className="dashboard-home">
      <section className="dashboard-welcome">
        <div>
          <span className="dashboard-eyebrow"><Sparkles size={14} /> YOUR CREATIVE SPACE</span>
          <h1>Make something <em>remarkable.</em></h1>
          <p>Bring your ideas to life with AI video, avatars, and voice.</p>
        </div>
        <span className="dashboard-welcome-mark" aria-hidden="true"><Sparkles size={24} /></span>
      </section>

      <section className="feature-section" aria-labelledby="feature-heading">
        <div className="feature-section-heading">
          <div><span className="dashboard-section-kicker">YOUR TOOLKIT</span><h2 id="feature-heading">What will you create today?</h2></div>
          <span className="feature-count">05 EXPERIENCES</span>
        </div>
        <div className="feature-bento">
          {allDestinations.map((feature, index) => {
            const media = mediaBySlug[feature.slug];
            const Icon = feature.icon;
            return (
              <Link className={`feature-card feature-card-${index + 1}`} href={`/${feature.slug}`} key={feature.slug}>
                {media.type === "video" ? (
                  <video className="feature-card-media" autoPlay muted loop playsInline aria-hidden="true" tabIndex={-1}>
                    <source src={media.src} type="video/mp4" />
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="feature-card-media" src={media.src} alt="" />
                )}
                <span className="feature-card-overlay" />
                <span className="feature-card-content">
                  <span className="feature-card-icon"><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="feature-card-copy"><strong>{feature.label}</strong><small>{feature.description}</small></span>
                </span>
                <span className="feature-card-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
                <span className="feature-card-index">0{index + 1}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="dashboard-home-footer"><span>AI Studio <i>•</i> your ideas, in motion</span><span>Choose a tool to get started</span></footer>
    </div>
  );
}
