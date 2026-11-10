"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const saved = window.localStorage.getItem("ai-studio-theme");
      root.classList.toggle("dark", saved ? saved === "dark" : media.matches);
      window.dispatchEvent(new Event("ai-theme-change"));
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return <>{children}</>;
}
