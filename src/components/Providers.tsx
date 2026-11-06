"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { useSettings } from "@/lib/store";
import { Toaster } from "@/components/ui/toaster";

// ─── Providers · dark-by-default theme + bilingual dir switching + SW ────────

export function Providers({ children }: { children: React.ReactNode }) {
  const lang = useSettings((s) => s.lang);

  // Keep <html> lang/dir in sync with the persisted UI language
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // Register the Senku service worker (PWA offline shell + runtime caching)
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
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
      <Toaster />
    </ThemeProvider>
  );
}
