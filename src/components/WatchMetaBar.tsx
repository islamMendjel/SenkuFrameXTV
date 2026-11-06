"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Meta } from "@/types";
import { displayName } from "@/lib/i18n";
import { useT } from "@/hooks/useT";
import { useSettings, useWatchlist } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck, ChevronLeft, Clapperboard, Share2, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── WatchMetaBar · the Screening Room's context bar ────────────────────────
// Sits directly under the Cinema Stage on watch pages: everything a viewer
// needs while the stream runs (title, rating, year, genres, list toggle,
// share) in one compact glass bar — the full DetailsHeader remains the
// browse-page pattern, but on a watch page the player is the hero.

interface Props {
  meta: Meta;
  /** Extra chip rendered first in the pill row (e.g. "S2 · E5"). */
  badge?: string;
}

export function WatchMetaBar({ meta, badge }: Props) {
  const router = useRouter();
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const has = useWatchlist((s) => s.items.some((i) => i.imdbId === meta.imdb_id));
  const toggle = useWatchlist((s) => s.toggle);

  const title = displayName(meta.name, lang);
  const year = meta.releaseInfo?.split("–")[0]?.slice(0, 4);
  const runtime = meta.runtime ? meta.runtime.replace(/min.*/, "").trim() : null;

  const share = useCallback(async () => {
    const url = `${window.location.origin}/movie/${meta.imdb_id}`;
    const shareData = {
      title: `${meta.name} — Senku frameXTV`,
      text: meta.description?.slice(0, 120) ?? title,
      url,
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user aborted the native sheet — nothing to report
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ description: t("linkCopied") });
    } catch {
      toast({ description: url });
    }
  }, [meta.imdb_id, meta.name, meta.description, title, t]);

  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border/50 p-3 sm:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label={t("back")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-card/60 text-muted-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4 flip-x" aria-hidden />
        </button>

        {meta.poster ? (
          <img
            src={meta.poster}
            alt=""
            className="hidden h-14 w-10 shrink-0 rounded-lg border border-border/60 object-cover sm:block"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="hidden h-14 w-9 shrink-0 items-center justify-center rounded-lg bg-card sm:flex">
            <Clapperboard className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
        )}

        <div className="min-w-0">
          <Link
            href={`/movie/${meta.imdb_id}`}
            className="block truncate text-base font-black tracking-tight hover:text-primary sm:text-lg"
            dir="auto"
          >
            {title}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-muted-foreground">
            {badge && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{badge}</span>
            )}
            {meta.imdbRating && parseFloat(meta.imdbRating) > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="h-3 w-3 fill-amber-400" aria-hidden />
                {meta.imdbRating}
              </span>
            )}
            {year && <span>{year}</span>}
            {runtime && (
              <span>
                {runtime} {t("min")}
              </span>
            )}
            {meta.genres?.slice(0, 2).map((g) => (
              <span key={g} className="rounded-full bg-white/10 px-2 py-0.5">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
          aria-label={has ? `${title} — ${t("inList")}` : `${title} — ${t("addToList")}`}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all",
            has
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-white/20 bg-white/10 text-white hover:border-primary/50 hover:text-primary"
          )}
        >
          {has ? (
            <BookmarkCheck className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="hidden sm:inline">{has ? t("inList") : t("addToList")}</span>
        </button>

        <button
          onClick={share}
          aria-label={t("share")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-all hover:border-primary/50 hover:text-primary"
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
