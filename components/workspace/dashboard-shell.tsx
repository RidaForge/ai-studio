"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  CreditCard,
  LogOut,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { Brand } from "@/components/auth/auth-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { navigationItems } from "@/components/workspace/workspace-data";

type UserInfo = { email: string; name: string | null };

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button className="dashboard-signout" type="submit" disabled={pending}>
      <LogOut size={16} />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}

export function DashboardShell({ user, children }: { user: UserInfo; children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentItem = navigationItems.find((item) => item.href === pathname);
  const currentLabel = currentItem?.label ?? "Workspace";

  return (
    <div className="dashboard-shell">
      {sidebarOpen && (
        <button className="dashboard-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`dashboard-sidebar${sidebarOpen ? " dashboard-sidebar-open" : ""}`}>
        <div className="dashboard-brand-row">
          <Brand small />
          <button className="dashboard-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="dashboard-workspace-chip">
          <span className="dashboard-workspace-mark"><Sparkles size={16} /></span>
          <span><strong>AI Studio</strong><small>Creative workspace</small></span>
        </div>

        <span className="dashboard-nav-label">WORKSPACE</span>
        <nav className="dashboard-nav" aria-label="Main navigation">
          {navigationItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                className={`dashboard-nav-link${active ? " dashboard-nav-active" : ""}`}
                href={href}
                key={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <Link className="dashboard-billing-link" href="/billing-settings" onClick={() => setSidebarOpen(false)}>
            <CreditCard size={16} /><span>User billing settings</span>
          </Link>
          <div className="dashboard-credit-row">
            <span>Available credits</span><strong aria-label="Credit balance unavailable">—</strong>
          </div>
          <div className="dashboard-user-row">
            <span className="dashboard-user-avatar"><CircleUserRound size={18} /></span>
            <span className="dashboard-user-copy"><strong>{user.name || user.email}</strong><small>{user.email}</small></span>
          </div>
          <form action={signOutAction}><SignOutButton /></form>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="dashboard-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={19} />
          </button>
          <div className="dashboard-breadcrumb"><span>Workspace</span><i>/</i><strong>{currentLabel}</strong></div>
          <div className="dashboard-topbar-actions"><span className="dashboard-status"><i /> Your creative space</span><ThemeToggle compact /></div>
        </header>
        <div className="dashboard-page-content">{children}</div>
      </main>
    </div>
  );
}
