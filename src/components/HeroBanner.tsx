"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Meta } from "@/types";
import { displayName } from "@/lib/i18n";
import { useT } from "@/hooks/useT";
import { useSettings } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Info, Play, Star } from "lucide-react";

// ─── HeroBanner · cinematic auto-carousel with ken-burns backdrops ───────────

const ROTATE_MS = 7000;

export function HeroBanner({ metas }: { metas: Meta[] }) {
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = Math.min(metas.length, 5);

  useEffect(() => {
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count]);

  const pause = () => {
    if (timer.current) clearInterval(timer.current);
  };
  const resume = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
  };

  if (metas.length === 0) return null;
  const hero = metas[index % count];
  const title = displayName(hero.name, lang);
  const year = hero.releaseInfo?.split("–")[0]?.slice(0, 4);
  const href = hero.type === "series" ? `/tv/${hero.imdb_id}` : `/movie/${hero.imdb_id}`;

  return (
    <section
      className="relative h-[68vh] min-h-[420px] w-full overflow-hidden sm:h-[76vh]"
      aria-label={t("heroNow")}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* backdrops */}
      {metas.slice(0, 5).map((m, i) => (
        <div
          key={m.imdb_id}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            i === index ? "opacity-100" : "opacity-0"
          )}
        >
          {m.background || m.poster ? (
            <img
              src={m.background ?? m.poster}
              alt=""
              className={cn("h-full w-full object-cover", i === index && "animate-kenburns")}
              fetchPriority={i === 0 ? "high" : "auto"}
            />
          ) : null}
        </div>
      ))}

      {/* cinematic veils */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden />

      {/* content */}
      <div className="absolute inset-0 flex items-end pb-16 sm:items-center sm:pb-24">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div key={hero.imdb_id} className="max-w-2xl space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <span className="inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary" aria-hidden />
              {t("heroNow")}
            </p>

            <h1 className="text-3xl font-black leading-tight tracking-tight drop-shadow-lg sm:text-5xl lg:text-6xl" dir="auto">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">
              {hero.imdbRating && (
                <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" aria-hidden />
                  {hero.imdbRating}
                </span>
              )}
              {year && <span className="rounded-full bg-black/40 px-2.5 py-1 text-white backdrop-blur-sm">{year}</span>}
              {hero.genres?.slice(0, 3).map((g) => (
                <span key={g} className="rounded-full bg-black/40 px-2.5 py-1 text-white backdrop-blur-sm">
                  {g}
                </span>
              ))}
            </div>

            {hero.description && (
              <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-zinc-700 drop-shadow-sm dark:text-zinc-300 sm:line-clamp-3 sm:text-base" dir="auto">
                {hero.description}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1 sm:pt-2">
              <Link
                href={href}
                className="flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-black text-black shadow-[0_0_28px_rgba(16,185,129,0.45)] transition-all hover:scale-[1.03] hover:shadow-[0_0_38px_rgba(16,185,129,0.6)] active:scale-95"
              >
                <Play className="h-4 w-4 fill-black" aria-hidden />
                {t("watchNow")}
              </Link>
              <Link
                href={href}
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md transition-all hover:border-white/40 hover:bg-white/20"
              >
                <Info className="h-4 w-4" aria-hidden />
                {t("moreInfo")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* dots */}
      <div className="absolute bottom-5 end-5 z-10 flex gap-1.5" role="tablist" aria-label="hero slides">
        {metas.slice(0, 5).map((m, i) => (
          <button
            key={m.imdb_id}
            role="tab"
            aria-selected={i === index}
            aria-label={m.name}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-7 bg-primary shadow-[0_0_10px_rgba(16,185,129,0.7)]" : "w-2.5 bg-white/30 hover:bg-white/50"
            )}
          />
        ))}
      </div>
    </section>
  );
}
