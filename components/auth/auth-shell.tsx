import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link className={`brand ${small ? "brand-small" : ""}`} href="/" aria-label="AI Studio home">
      <span className="brand-mark"><Sparkles size={17} strokeWidth={2.4} /></span>
      <span>AI Studio<span className="brand-dot">.</span></span>
    </Link>
  );
}

export function AuthShell({ children, eyebrow, title, description }: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="auth-page">
      <header className="auth-topbar"><Brand /><ThemeToggle compact /></header>
      <div className="auth-layout">
        <section className="auth-art" aria-label="AI Studio workspace">
          <div className="auth-art-glow" />
          <div className="auth-art-content">
            <div className="auth-art-kicker"><span className="status-dot" /> Your creative workspace</div>
            <h2>Ideas deserve<br />to become <em>real.</em></h2>
            <p>One thoughtful workspace for everything you want to make.</p>
            <div className="art-preview">
              <div className="art-preview-top"><span /><span /><span /><b>Untitled concept</b><small>Just now</small></div>
              <div className="art-preview-scene">
                <div className="scene-orb" />
                <div className="scene-lines"><i /><i /><i /></div>
                <span className="scene-caption">A quieter kind of focus</span>
              </div>
            </div>
            <div className="auth-quote"><span>“</span><div><strong>Make space for the first draft.</strong><small>Your next favorite thing starts here.</small></div></div>
          </div>
          <div className="auth-art-foot"><span>DESIGNED FOR THE WORK IN PROGRESS</span><span>01 — 04</span></div>
        </section>
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <div className="auth-heading">
              <span className="auth-eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
      <footer className="auth-mobile-footer"><Brand small /><span>Make something good.</span></footer>
    </main>
  );
}
