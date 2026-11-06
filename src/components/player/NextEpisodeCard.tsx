"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DictKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Play, X } from "lucide-react";

// ─── NextEpisodeCard · Binge Autopilot countdown (end-of-episode) ────────────

export interface NextEpisodeInfo {
  href: string;
  label: string; // "S8 · E22"
  title: string; // episode title
  poster?: string;
}

interface Props {
  next: NextEpisodeInfo;
  poster?: string; // show poster fallback
  onDone: () => void; // dismissed / navigated
  t: (k: DictKey) => string;
}

const COUNTDOWN_S = 10;
const R = 26;
const CIRC = 2 * Math.PI * R;

export function NextEpisodeCard({ next, poster, onDone, t }: Props) {
  const router = useRouter();
  const [left, setLeft] = useState(COUNTDOWN_S);

  // countdown drives itself via effect on `left` — navigation happens OUTSIDE
  // any setState updater (updater bodies run during render → illegal parent setState)
  useEffect(() => {
    if (left <= 0) {
      onDone(); // let parent unmount before navigating
      router.push(next.href);
      return;
    }
    const tm = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(tm);
  }, [left]);

  const goNow = () => {
    onDone();
    router.push(next.href);
  };

  const art = next.poster || poster;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
      role="dialog"
      aria-label={t("upNext")}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/90 p-5 shadow-2xl">
        <div className="flex items-center gap-4">
          {/* countdown ring */}
          <div className="relative h-16 w-16 shrink-0" aria-hidden>
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - left / COUNTDOWN_S)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-white tabular-nums">
              {left}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-primary">
              {t("upNext")} · {t("autopilotOn")}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-400">{t("autopilotIn")}…</p>
            <p className="mt-1 truncate text-base font-black text-white" dir="auto">
              {next.label}
              {next.title ? ` — ${next.title}` : ""}
            </p>
          </div>

          {art && (
            <img
              src={art}
              alt=""
              className="hidden h-20 w-14 shrink-0 rounded-lg object-cover opacity-80 sm:block"
              loading="lazy"
            />
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={goNow}
            className={cn(
              "flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5",
              "text-sm font-black text-primary-foreground transition-transform active:scale-95"
            )}
          >
            <Play className="h-4 w-4 fill-primary-foreground" aria-hidden />
            {t("playNow")}
          </button>
          <button
            onClick={onDone}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-zinc-300 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
