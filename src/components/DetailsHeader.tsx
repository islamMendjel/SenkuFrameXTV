"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Meta } from "@/types";
import { displayName } from "@/lib/i18n";
import { useT } from "@/hooks/useT";
import { useSettings, useWatchlist, useHistory } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck, ChevronLeft, Clapperboard, Play, Star } from "lucide-react";

// ─── DetailsHeader · cinematic backdrop + poster + meta + actions ────────────

interface Props {
  meta: Meta;
  watchHref?: string; // href that scrolls to player / first episode
  watchLabel?: string;
}

export function DetailsHeader({ meta, watchHref, watchLabel }: Props) {
  const router = useRouter();
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const has = useWatchlist((s) => s.items.some((i) => i.imdbId === meta.imdb_id));
  const toggle = useWatchlist((s) => s.toggle);
  const entry = useHistory((s) => s.entries[meta.imdb_id]);

  const title = displayName(meta.name, lang);
  const year = meta.releaseInfo?.split("–")[0]?.slice(0, 4);
  const runtime = meta.runtime ? meta.runtime.replace(/min.*/, "").trim() : null;

  // resume-aware CTA — if this viewer left mid-season, the button jumps
  // straight back to the exact episode instead of the first one
  const resumeHref =
    entry?.season && entry.episode
      ? `/tv/${meta.imdb_id}/${entry.season}/${entry.episode}`
      : null;
  const finalHref = resumeHref ?? watchHref ?? "#watch";
  const finalLabel = resumeHref
    ? `${t("resume")} · S${entry?.season}·E${entry?.episode}`
    : (watchLabel ?? t("watchNow"));

  return (
    <section className="relative w-full overflow-hidden">
      {/* backdrop */}
      <div className="absolute inset-0 h-[420px]" aria-hidden>
        {meta.background || meta.poster ? (

          <img
            src={(meta.background ?? meta.poster) + ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 pt-24 sm:px-6 sm:pt-28 lg:px-10">
        <button
          onClick={() => router.back()}
          className="mb-4 flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 text-xs font-bold text-muted-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4 flip-x" aria-hidden />
          {t("back")}
        </button>

        <div className="flex flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:gap-7">
          {/* poster */}
          <div className="w-32 shrink-0 overflow-hidden rounded-2xl border border-border/60 shadow-2xl sm:w-44 lg:w-52">
            {meta.poster ? (

              <img src={meta.poster} alt={title} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center bg-card">
                <Clapperboard className="h-8 w-8 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>

          {/* info */}
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-2xl font-black leading-tight tracking-tight drop-shadow-lg sm:text-4xl lg:text-5xl" dir="auto">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-[13px]">
              {meta.imdbRating && parseFloat(meta.imdbRating) > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" aria-hidden />
                  {meta.imdbRating}
                  <span className="text-amber-400/60">IMDb</span>
                </span>
              )}
              {year && <span className="rounded-full bg-white/10 px-2.5 py-1">{year}</span>}
              {runtime && (
                <span className="rounded-full bg-white/10 px-2.5 py-1">
                  {runtime} {t("min")}
                </span>
              )}
              {meta.genres?.slice(0, 4).map((g) => (
                <span key={g} className="rounded-full bg-white/10 px-2.5 py-1">
                  {g}
                </span>
              ))}
            </div>

            {meta.description && (
              <p
                className="max-w-3xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 sm:line-clamp-3"
                dir="auto"
              >
                {meta.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={finalHref}
                className="flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-black text-black shadow-[0_0_28px_rgba(16,185,129,0.45)] transition-all hover:scale-[1.03] hover:shadow-[0_0_38px_rgba(16,185,129,0.6)] active:scale-95"
              >
                <Play className="h-4 w-4 fill-black" aria-hidden />
                {finalLabel}
              </a>
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
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold backdrop-blur-md transition-all",
                  has
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/20 bg-white/10 text-white hover:border-white/40"
                )}
              >
                {has ? (
                  <BookmarkCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Bookmark className="h-4 w-4" aria-hidden />
                )}
                {has ? t("inList") : t("addToList")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
