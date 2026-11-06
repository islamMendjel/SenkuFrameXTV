"use client";

import { memo } from "react";
import Link from "next/link";
import type { Meta } from "@/types";
import { displayName } from "@/lib/i18n";
import { useT } from "@/hooks/useT";
import { useSettings, useWatchlist, useHistory } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck, Play, Star } from "lucide-react";

// ─── MediaCard · poster card w/ rating, watchlist, progress, deep-play ───────
// Two paths, two intents: the poster opens the details page; the centered
// play chip (hover on desktop) jumps STRAIGHT into the picture — movies land
// on the Screening Room stage (#watch), series resume the exact episode the
// viewer left (or start the pilot). No extra clicks between impulse and play.

interface Props {
  meta: Meta;
  className?: string;
  priority?: boolean;
}

function MediaCardBase({ meta, className }: Props) {
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const has = useWatchlist((s) => s.items.some((i) => i.imdbId === meta.imdb_id));
  const toggle = useWatchlist((s) => s.toggle);
  const historyEntry = useHistory((s) => s.entries[meta.imdb_id]);

  const href =
    meta.type === "series"
      ? `/tv/${meta.imdb_id}`
      : `/movie/${meta.imdb_id}`;
  const title = displayName(meta.name, lang);
  const year = meta.releaseInfo?.split("–")[0]?.slice(0, 4);

  // deep-play target — resume the exact episode, else the pilot, else details
  const playHref =
    meta.type === "movie"
      ? `/movie/${meta.imdb_id}#watch`
      : historyEntry?.season && historyEntry.episode
        ? `/tv/${meta.imdb_id}/${historyEntry.season}/${historyEntry.episode}`
        : `/tv/${meta.imdb_id}/1/1`;

  return (
    <div className={cn("group relative", className)}>
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        aria-label={title}
      >
        {/* poster */}
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-primary/10 group-hover:shadow-xl">
          {meta.poster ? (

            <img
              src={meta.poster}
              alt={title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
              <span className="px-2 text-center text-xs font-semibold text-zinc-500">{title}</span>
            </div>
          )}

          {/* gradient veil */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 opacity-70 transition-opacity duration-300 group-hover:opacity-90" />

          {/* rating */}
          {meta.imdbRating && parseFloat(meta.imdbRating) > 0 && (
            <span className="absolute end-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-amber-400 backdrop-blur-sm">
              <Star className="h-3 w-3 fill-amber-400" aria-hidden />
              {meta.imdbRating}
            </span>
          )}

          {/* title + year */}
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <p className="line-clamp-2 text-[13px] font-bold leading-tight text-white drop-shadow">
              {title}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-zinc-400">
              {year}
              {meta.type === "series" && !year ? "TV" : meta.type === "series" ? " · TV" : ""}
            </p>
          </div>

          {/* continue-watching progress */}
          {historyEntry && historyEntry.progressPct > 1 && (
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/60">
              <div
                className="h-full bg-primary shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                style={{ width: `${historyEntry.progressPct}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      {/* deep-play chip — its own link above the poster: movies land on the
          Screening Room stage, series resume/pilot. Rises on hover/focus;
          tapping the poster itself still opens details (touch-friendly). */}
      <Link
        href={playHref}
        aria-label={`${title} — ${t("watchNow")}`}
        className="absolute left-1/2 top-[42%] z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 scale-75 items-center justify-center rounded-full bg-primary/95 text-black opacity-0 shadow-[0_0_24px_rgba(16,185,129,0.55)] transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 focus-visible:scale-110 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Play className="ms-0.5 h-5 w-5 fill-black" aria-hidden />
      </Link>

      {/* watchlist toggle */}
      <button
        onClick={() =>
          toggle({
            imdbId: meta.imdb_id,
            type: meta.type,
            title: meta.name,
            poster: meta.poster,
            year,
            rating: meta.imdbRating,
          })
        }
        aria-label={has ? title + " — " + "in list" : title + " — add to list"}
        className={cn(
          "absolute end-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 sm:opacity-0 sm:group-hover:opacity-100",
          has
            ? "border-primary/60 bg-primary/25 text-primary"
            : "border-white/20 bg-black/60 text-white hover:border-primary/50 hover:text-primary"
        )}
      >
        {has ? (
          <BookmarkCheck className="h-4 w-4" aria-hidden />
        ) : (
          <Bookmark className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

export const MediaCard = memo(MediaCardBase);
