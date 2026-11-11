"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowDownRight, ArrowUpRight, AudioLines, Bookmark, ChevronDown, CircleHelp,
  Clock3, Command, FileText, FolderOpen, ImagePlus, Layers3, Menu, Plus,
  Search, Settings2, Sparkles, WandSparkles, X, LogOut,
} from "lucide-react";
import { Brand } from "@/components/auth/auth-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/auth/actions";

type Mode = "text" | "image";

function SignOutButton() {
  const { pending } = useFormStatus();
  return <button className="side-link" type="submit" disabled={pending} aria-busy={pending}><LogOut size={16} /><span>{pending ? "Signing out…" : "Sign out"}</span></button>;
}

const suggestions = [
  "A launch note that feels warm, clear, and memorable",
  "A calm editorial cover for a creative journal",
  "Three fresh names for a neighborhood coffee shop",
];

export function Dashboard({ user }: { user: { email: string; name: string | null } }) {
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return <div className="workspace-shell">
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`workspace-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand-row"><Brand small /><button className="sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <button className="workspace-switcher" type="button" disabled title="Workspace management is coming soon"><span className="workspace-avatar"><Sparkles size={15} /></span><span className="workspace-switcher-copy"><strong>{user.name || "Personal workspace"}</strong><small>Personal workspace</small></span><ChevronDown size={15} /></button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Workspace navigation">
        <a href="#create" className="side-link active"><WandSparkles size={17} /><span>Studio</span><span className="nav-shortcut">⌘ 1</span></a>
        <a href="#recent" className="side-link"><Layers3 size={17} /><span>My creations</span><span className="nav-count">0</span></a>
        <button className="side-link pending-side" type="button" disabled><FolderOpen size={17} /><span>Collections</span><span className="pending-label">Soon</span></button>
      </nav>
      <div className="sidebar-divider" />
      <div className="sidebar-label">YOUR TOOLS</div>
      <nav className="side-nav" aria-label="Creation tools">
        <button className={`side-link ${mode === "text" ? "selected-tool" : ""}`} onClick={() => { setMode("text"); setSidebarOpen(false); }}><FileText size={17} /><span>Write with AI</span></button>
        <button className={`side-link ${mode === "image" ? "selected-tool" : ""}`} onClick={() => { setMode("image"); setSidebarOpen(false); }}><ImagePlus size={17} /><span>Create an image</span></button>
        <button className="side-link pending-side" type="button" disabled><AudioLines size={17} /><span>Make audio</span><span className="pending-label">Soon</span></button>
      </nav>
      <div className="sidebar-bottom">
        <button className="side-link pending-side" type="button" disabled><CircleHelp size={17} /><span>Help center</span><span className="pending-label">Soon</span></button>
        <button className="side-link pending-side" type="button" disabled><Settings2 size={17} /><span>Settings</span><span className="pending-label">Soon</span></button>
        <div className="sidebar-divider" />
        <div className="sidebar-user"><span className="user-avatar"><Command size={16} /></span><span className="user-meta"><strong>{user.name || user.email}</strong><small>{user.email}</small></span></div>
        <form action={signOutAction} className="sidebar-signout"><SignOutButton /></form>
      </div>
    </aside>

    <main className="workspace-main">
      <header className="workspace-topbar">
        <button className="mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="crumb-sep">/</span><strong>Studio</strong></div>
        <div className="topbar-actions"><span className="connection-pill"><i /> AI backend pending</span><button className="icon-button" aria-label="Search" disabled><Search size={17} /></button><ThemeToggle compact /></div>
      </header>

      <div className="workspace-content">
        <section className="welcome-row">
          <div><div className="welcome-eyebrow"><span className="welcome-spark"><Sparkles size={14} /></span> YOUR CREATIVE SPACE</div><h1>Make something <em>wonderful.</em></h1><p>Start with a thought. Let’s see where it takes you.</p></div>
          <div className="welcome-date"><span className="date-icon"><Clock3 size={16} /></span><span><small>YOUR STUDIO</small><strong>Ready when you are</strong></span><ArrowDownRight size={16} /></div>
        </section>

        <section id="create" className="creation-grid">
          <div className="composer-card">
            <div className="composer-topline"><div className="composer-title"><span className="composer-icon"><WandSparkles size={17} /></span><span><strong>New creation</strong><small>Choose a canvas and shape your idea</small></span></div><span className="draft-pill"><i /> NEW DRAFT</span></div>
            <div className="mode-tabs" role="tablist" aria-label="Creation type">
              <button role="tab" aria-selected={mode === "text"} className={mode === "text" ? "mode-active" : ""} onClick={() => setMode("text")}><FileText size={16} /> Text <span>01</span></button>
              <button role="tab" aria-selected={mode === "image"} className={mode === "image" ? "mode-active" : ""} onClick={() => setMode("image")}><ImagePlus size={16} /> Image <span>02</span></button>
            </div>
            <div className="prompt-header"><label htmlFor="prompt">{mode === "text" ? "What would you like to write?" : "What do you want to see?"}</label><span>{mode === "text" ? "A good brief is a little bit of magic." : "Describe the image in your imagination."}</span></div>
            <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === "text" ? "A product description for a new collection of handmade ceramics…" : "Soft morning light over a sculptural clay vase, warm neutral tones…"} maxLength={2000} />
            <div className="prompt-footer"><span className="prompt-hint"><Sparkles size={13} /> Be specific. The details make it yours.</span><span className="character-count">{prompt.length} / 2,000</span></div>
            <div className="composer-actions"><button className="secondary-button" type="button" disabled><Plus size={16} /> Add reference <span className="soon-mini">Soon</span></button><span className="action-spacer" /><button className="primary-button generate-button" type="button" disabled title="Generation will be enabled when the InsForge AI integration is configured"><Sparkles size={16} /> Generate <span className="generate-shortcut">↵</span></button></div>
            <div className="generation-pending"><span className="pending-ring"><Sparkles size={14} /></span><span><strong>AI generation pending</strong><small>InsForge AI setup and model verification are required before this prompt can run.</small></span></div>
          </div>

          <aside className="idea-card">
            <div className="idea-card-top"><span className="idea-badge"><Sparkles size={13} /> A STARTING POINT</span><span className="idea-orbit"><i /><i /><i /></span></div>
            <div className="idea-copy"><span className="idea-number">01 / 03</span><h2>Not sure where<br />to begin?</h2><p>Borrow a little momentum. Pick a prompt and make it your own.</p></div>
            <div className="suggestion-list">{suggestions.map((suggestion, index) => <button className="suggestion" key={suggestion} onClick={() => setPrompt(suggestion)}><span>0{index + 1}</span><strong>{suggestion}</strong><ArrowUpRight size={15} /></button>)}</div>
            <div className="idea-foot"><span>MADE FOR THE FIRST DRAFT</span><Bookmark size={14} /></div>
          </aside>
        </section>

        <section className="recent-section" id="recent">
          <div className="section-heading"><div><span className="section-eyebrow">YOUR WORK, AT A GLANCE</span><h2>Recent creations</h2></div><button className="view-all" disabled>View library <ArrowUpRight size={14} /></button></div>
          <div className="empty-creations"><div className="empty-art"><span className="empty-art-card empty-art-back" /><span className="empty-art-card empty-art-mid" /><span className="empty-art-card empty-art-front"><Sparkles size={20} /></span></div><h3>Your next idea goes here.</h3><p>Once generation and saved history are connected, your latest work will find a home here.</p><a href="#create" className="empty-cta">Start a new creation <span>↑</span></a></div>
        </section>

        <footer className="workspace-footer"><span>AI Studio <i>•</i> a space to make</span><span>AI generation and saved history are pending backend integration.</span></footer>
      </div>
    </main>
  </div>;
}
