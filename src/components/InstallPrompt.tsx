"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useSettings } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { Download, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// ─── InstallPrompt · subtle Android PWA install banner ───────────────────────
// Hidden on watch pages: nothing should overlay the player during playback
// (it was clipping the Autopilot card + transport controls).

export function InstallPrompt() {
  const { canInstall, install } = usePWAInstall();
  const t = useT();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  const onWatchPage = /^\/tv\/[^/]+\/\d+\/\d+/.test(pathname) || /^\/movie\//.test(pathname);
  const show = canInstall && !dismissed && !onWatchPage;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          className="fixed inset-x-3 bottom-[68px] z-40 mx-auto max-w-md rounded-2xl border border-primary/40 bg-card/95 p-3 shadow-2xl shadow-primary/10 backdrop-blur-xl lg:bottom-4 lg:end-4 lg:mx-0 lg:max-w-sm"
          role="dialog"
          aria-label={t("install")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Download className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{t("appName")}</p>
              <p className="truncate text-[11px] text-muted-foreground">{t("tagline")}</p>
            </div>
            <button
              onClick={install}
              className="min-h-[36px] shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-black text-black transition-transform active:scale-95"
            >
              {t("install")}
            </button>
            <button
              onClick={() => setDismissed(true)}
              aria-label="dismiss"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
