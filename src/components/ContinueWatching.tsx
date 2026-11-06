"use client";

import Link from "next/link";
import { useRecentHistory } from "@/lib/store";
import { useSettings } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { History, Play, X } from "lucide-react";
import { useHistory } from "@/lib/store";
import { cn } from "@/lib/utils";

// ─── ContinueWatching · resume row from persisted history ────────────────────

export function ContinueWatching() {
  const t = useT();
  const entries = useRecentHistory(10);
  const remove = useHistory((s) => s.remove);

  if (entries.length === 0) return null;

  return (
    <section className="space-y-3 px-4 sm:px-6 lg:px-10" aria-label={t("continueWatching")}>
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight sm:text-lg">
        <History className="h-5 w-5 text-primary" aria-hidden />
        {t("continueWatching")}
      </h2>

      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:gap-4">
        {entries.map((e) => {
          const href =
            e.type === "series" && e.season && e.episode
              ? `/tv/${e.imdbId}/${e.season}/${e.episode}`
              : e.type === "series"
                ? `/tv/${e.imdbId}`
                : `/movie/${e.imdbId}`;
          return (
            <div key={e.imdbId} className="group relative w-[240px] shrink-0 sm:w-[280px]">
              <Link
                href={href}
                className="block overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/50"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                  {e.poster && (

                    <img
                      src={e.poster.replace("_V1_SX250", "_V1_SX640")}
                      alt={e.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/95 text-black opacity-0 shadow-[0_0_24px_rgba(16,185,129,0.6)] transition-opacity group-hover:opacity-100">
                      <Play className="ms-0.5 h-5 w-5 fill-black" aria-hidden />
                    </span>
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-2.5 text-start">
                    <p className="truncate text-xs font-bold text-white" dir="auto">
                      {e.title}
                    </p>
                    {e.type === "series" && e.season && e.episode && (
                      <p className="text-[10px] text-zinc-400">
                        {t("season")} {e.season} · {t("episode")} {e.episode}
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/60">
                    <div
                      className={cn("h-full bg-primary shadow-[0_0_8px_rgba(16,185,129,0.8)]")}
                      style={{ width: `${e.progressPct}%` }}
                    />
                  </div>
                </div>
              </Link>
              <button
                onClick={() => remove(e.imdbId)}
                aria-label={t("remove")}
                className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-zinc-300 opacity-0 backdrop-blur-sm transition-all hover:text-white group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
