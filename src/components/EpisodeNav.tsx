"use client";

import Link from "next/link";
import type { Meta } from "@/types";
import { useSettings } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { displayName } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

// ─── EpisodeNav · title + S/E + prev/next episode shortcuts ──────────────────

interface Props {
  meta: Meta;
  season: number;
  episode: number;
  imdbId: string;
}

export function EpisodeNav({ meta, season, episode, imdbId }: Props) {
  const lang = useSettings((s) => s.lang);
  const t = useT();

  const eps = (meta.videos ?? [])
    .filter((v) => v.season === season)
    .sort((a, b) => a.episode - b.episode);

  const idx = eps.findIndex((v) => v.episode === episode);
  const prev = idx > 0 ? eps[idx - 1] : null;
  const next = idx >= 0 && idx < eps.length - 1 ? eps[idx + 1] : null;

  const current = eps[idx];
  const epTitle = current?.title || current?.name;

  return (
    <div className="space-y-3 px-4 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl" dir="auto">
            {epTitle ?? `${t("episode")} ${episode}`}
          </h1>
          <p className="text-xs font-semibold text-muted-foreground">
            {displayName(meta.name, lang)} · {t("season")} {season} · {t("episode")} {episode}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {prev ? (
            <Link
              href={`/tv/${imdbId}/${season}/${prev.episode}`}
              className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-bold text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4 flip-x" aria-hidden />
              {t("prevEp")}
            </Link>
          ) : (
            <span
              aria-disabled
              className="flex min-h-[38px] cursor-not-allowed items-center gap-1.5 rounded-full border border-border/30 bg-card/30 px-4 py-2 text-xs font-bold text-muted-foreground/40"
            >
              <ChevronLeft className="h-4 w-4 flip-x" aria-hidden />
              {t("prevEp")}
            </span>
          )}

          {next ? (
            <Link
              href={`/tv/${imdbId}/${season}/${next.episode}`}
              className="flex min-h-[38px] items-center gap-1.5 rounded-full bg-primary/15 px-4 py-2 text-xs font-black text-primary transition-all hover:bg-primary/25"
            >
              {t("nextEp")}
              <ChevronRight className="h-4 w-4 flip-x" aria-hidden />
            </Link>
          ) : (
            <span
              aria-disabled
              className="flex min-h-[38px] cursor-not-allowed items-center gap-1.5 rounded-full border border-border/30 bg-card/30 px-4 py-2 text-xs font-bold text-muted-foreground/40"
            >
              {t("nextEp")}
              <ChevronRight className="h-4 w-4 flip-x" aria-hidden />
            </span>
          )}
        </div>
      </div>

      <div className={cn("flex items-center gap-2 text-xs font-bold text-primary")}>
        <Play className="h-3.5 w-3.5 fill-primary" aria-hidden />
        {t("playerTitle")} · {t("season")} {season} · {t("episode")} {episode}
      </div>
    </div>
  );
}
