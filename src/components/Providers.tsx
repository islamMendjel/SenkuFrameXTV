"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { useSettings } from "@/lib/store";
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "@/components/CommandPalette";

// ─── Providers · dark-by-default theme + bilingual dir switching + SW ────────

export function Providers({ children }: { children: React.ReactNode }) {
  const lang = useSettings((s) => s.lang);

  // Keep <html> lang/dir in sync with the persisted UI language
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // Service worker hygiene:
  //  - production → register the PWA shell worker
  //  - development → unregister any worker left over from an older session
  //    and purge its caches, so stale bundles can never masquerade as updates
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((k) => k.startsWith("senku-"))
                .map((k) => caches.delete(k))
            )
          )
          .catch(() => {});
      }
    }
  }, []);

  // Stale-tab auto-recovery: ping the server build fingerprint every 60s and
  // on tab focus. If the server has restarted (new code), reload once.
  useEffect(() => {
    let current: string | null = null;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = (await res.json()) as { v?: string };
        if (!data.v) return;
        if (current === null) {
          current = data.v;
          return;
        }
        if (
          data.v !== current &&
          sessionStorage.getItem("senku-reloaded") !== data.v
        ) {
          sessionStorage.setItem("senku-reloaded", data.v);
          window.location.reload();
        }
      } catch {
        /* offline — ignore */
      } finally {
        checking = false;
      }
    };
    check();
    const iv = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark" // dark by default (user requirement)
      enableSystem={false}
      disableTransitionOnChange
      themes={["dark", "light"]}
    >
      {children}
      {/* global ⌘K command palette — instant search + actions on every page */}
      <CommandPalette />
      <Toaster />
    </ThemeProvider>
  );
}
