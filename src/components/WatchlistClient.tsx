"use client";

import Link from "next/link";
import { useSettings, useWatchlist } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { MediaCard } from "@/components/MediaCard";
import type { Meta } from "@/types";
import { Bookmark, Clapperboard, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── WatchlistClient · persisted list, grid + clear all ──────────────────────

export function WatchlistClient() {
  const t = useT();
  const items = useWatchlist((s) => s.items);
  const clear = useWatchlist((s) => s.clear);

  const asMetas: Meta[] = items.map((i) => ({
    imdb_id: i.imdbId,
    type: i.type,
    name: i.title,
    poster: i.poster,
    releaseInfo: i.year,
    imdbRating: i.rating,
  }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-0 pb-10 pt-24 sm:px-6 lg:px-10">
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h1 className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl">
          <Bookmark className="h-6 w-6 text-primary" aria-hidden />
          {t("watchlist")}
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-black text-primary">
            {items.length}
          </span>
        </h1>
        {items.length > 0 && (
          <button
            onClick={() => {
              clear();
              toast({ title: t("remove"), description: t("appName") });
            }}
            className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/60 px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {t("reset")}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card/60 border border-border/50">
            <Clapperboard className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold">{t("watchlistEmpty")}</p>
            <p className="text-sm text-muted-foreground">{t("watchlistEmptyDesc")}</p>
          </div>
          <Link
            href="/"
            className="flex min-h-[44px] items-center rounded-full bg-primary px-6 py-2.5 text-sm font-black text-black shadow-[0_0_24px_rgba(16,185,129,0.4)] transition-transform hover:scale-105 active:scale-95"
          >
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 sm:gap-4 sm:px-0 lg:grid-cols-6 xl:grid-cols-7">
          {asMetas.map((m) => (
            <MediaCard key={m.imdb_id} meta={m} />
          ))}
        </div>
      )}
    </div>
  );
}
