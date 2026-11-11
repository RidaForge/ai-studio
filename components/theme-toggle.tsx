"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

function subscribeTheme(callback: () => void) {
  window.addEventListener("ai-theme-change", callback);
  return () => window.removeEventListener("ai-theme-change", callback);
}

function getTheme() {
  return document.documentElement.classList.contains("dark");
}

function getServerTheme() {
  return false;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const dark = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("ai-studio-theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("ai-theme-change"));
  }

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
      {!compact && <span>{dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
