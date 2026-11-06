"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EpisodeVideo, Meta } from "@/types";
import { useSettings, useWatchlist } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { History, Play } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── EpisodePicker · season select + episode list w/ resume badges ───────────

interface Props {
  meta: Meta;
  currentSeason?: number;
  currentEpisode?: number;
  imdbId: string;
  compact?: boolean;
}

export function EpisodePicker({ meta, currentSeason, currentEpisode, imdbId, compact }: Props) {
  const t = useT();
  const historyEntry = useWatchlist((s) => s.items); // placeholder to satisfy store import shape
  void historyEntry;

  const seasons = useMemo(() => {
    const set = new Set<number>();
    (meta.videos ?? []).forEach((v) => set.add(v.season));
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length ? arr : [1];
  }, [meta.videos]);

  const [season, setSeason] = useState<number>(
    currentSeason ?? seasons.find((s) => s > 0) ?? seasons[0]
  );

  const episodes = useMemo(
    () =>
      (meta.videos ?? [])
        .filter((v) => v.season === season)
        .sort((a, b) => a.episode - b.episode),
    [meta.videos, season]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
          {t("episodes")}
        </h3>
        <Select value={String(season)} onValueChange={(v) => setSeason(parseInt(v, 10))}>
          <SelectTrigger
            className="w-[150px] border-border/60 bg-card/60"
            aria-label={t("season")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {t("season")} {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          "space-y-2 overflow-y-auto pe-1 senku-scroll",
          compact ? "max-h-[420px]" : "max-h-[520px]"
        )}
        role="list"
        aria-label={`${t("season")} ${season}`}
      >
        {episodes.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
        )}
        {episodes.map((ep: EpisodeVideo) => {
          const active = ep.season === currentSeason && ep.episode === currentEpisode;
          const href = `/tv/${imdbId}/${ep.season}/${ep.episode}`;
          const epTitle = ep.title || ep.name || `${t("episode")} ${ep.episode}`;
          return (
            <Link
              key={ep.id || `${ep.season}-${ep.episode}`}
              href={href}
              role="listitem"
              className={cn(
                "group flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-200",
                active
                  ? "border-primary/60 bg-primary/10 neon-ring"
                  : "border-border/50 bg-card/40 hover:border-primary/40 hover:bg-card/80"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black",
                  active ? "bg-primary text-black" : "bg-muted text-muted-foreground group-hover:text-primary"
                )}
              >
                {ep.episode}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold" dir="auto">
                  {epTitle}
                </span>
                {ep.released && (
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(ep.released).getFullYear() || ""}
                  </span>
                )}
              </span>
              {active ? (
                <Play className="h-4 w-4 shrink-0 fill-primary text-primary" aria-hidden />
              ) : (
                <History className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
