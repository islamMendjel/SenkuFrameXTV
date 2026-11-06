import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeta } from "@/lib/cinemeta";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import type { NextEpisodeInfo } from "@/components/player/NextEpisodeCard";
import { EpisodePicker } from "@/components/EpisodePicker";
import { EpisodeNav } from "@/components/EpisodeNav";
import { displayName } from "@/lib/i18n";
import { ChevronLeft } from "lucide-react";

// ─── /tv/[id]/[season]/[episode] · episode watch page ────────────────────────

export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string; season: string; episode: string }>;
}

/** Next episode in airing order: same season +1, else season finale → next season's premiere. */
function findNextEpisode(
  videos: { season?: number; episode?: number; title?: string }[] | undefined,
  season: number,
  episode: number
): { seasonNum: number; epNum: number; title: string } | null {
  const eps = (videos ?? []).filter((v) => v.season === season && v.episode);
  const sorted = eps.sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
  const idx = sorted.findIndex((v) => v.episode === episode);
  let next: { season?: number; episode?: number; title?: string } | undefined;

  if (idx >= 0 && idx < sorted.length - 1) {
    next = sorted[idx + 1];
  } else {
    // finale → first episode of the next existing season
    const seasons = [...new Set((videos ?? []).map((v) => v.season).filter(Boolean))].sort(
      (a, b) => (a ?? 0) - (b ?? 0)
    );
    const nextSeason = seasons.find((s) => (s ?? 0) > season);
    if (nextSeason) {
      next = (videos ?? [])
        .filter((v) => v.season === nextSeason && v.episode)
        .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0))[0];
    }
  }
  if (!next?.season || !next?.episode) return null;
  return { seasonNum: next.season, epNum: next.episode, title: next.title ?? "" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, season, episode } = await params;
  const meta = await getMeta("series", id);
  if (!meta) return { title: "Episode" };
  const ep = meta.videos?.find(
    (v) => v.season === parseInt(season, 10) && v.episode === parseInt(episode, 10)
  );
  return {
    title: `${meta.name} S${season}·E${episode}${ep?.title ? ` — ${ep.title}` : ""}`,
    description: ep?.overview?.slice(0, 180) ?? meta.description?.slice(0, 180),
  };
}

export default async function EpisodePage({ params }: Props) {
  const { id, season: sStr, episode: eStr } = await params;
  if (!/^tt\d+/.test(id)) notFound();

  const season = parseInt(sStr, 10);
  const episode = parseInt(eStr, 10);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) notFound();

  const meta = await getMeta("series", id);
  if (!meta) notFound();

  const ep = meta.videos?.find((v) => v.season === season && v.episode === episode);

  const next = findNextEpisode(meta.videos, season, episode);
  const nextEpisode: NextEpisodeInfo | null = next
    ? {
        ...next,
        href: `/tv/${id}/${next.seasonNum}/${next.epNum}`,
        label: `S${String(next.seasonNum).padStart(2, "0")} · E${String(next.epNum).padStart(2, "0")}`,
        poster: meta.poster,
      }
    : null;

  return (
    <div className="senku-page-root relative isolate mx-auto max-w-[1600px] space-y-6 px-0 pb-10 sm:px-6 lg:px-10">
      {/* `isolate` keeps the ambient glow contained; the player's CSS
          fullscreen fallback lifts it via [data-fs-stage] (globals.css) so
          the fake-fullscreen stage can rise above the fixed navbar. */}
      {/* ambient cinema glow — poster light bleeding behind the stage; breathes
          up while the stream plays (.stage-ambient-src in globals.css) */}
      {meta.poster && (
        <div aria-hidden className="stage-ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
          <div
            className="stage-ambient-src absolute inset-0 bg-cover bg-top opacity-[0.16] blur-3xl saturate-150"
            style={{ backgroundImage: `url(${meta.poster})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/75 to-background" />
        </div>
      )}

      {/* breadcrumb */}
      <div className="px-4 pt-20 sm:px-0 lg:pt-24">
        <Link
          href={`/tv/${id}`}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4 flip-x" aria-hidden />
          <span dir="auto">{displayName(meta.name, "en")}</span>
        </Link>
      </div>

      <EpisodeNav meta={meta} season={season} episode={episode} imdbId={id} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <StreamPlayer
            key={`${id}-s${season}e${episode}`}
            type="series"
            imdbId={id}
            title={meta.name}
            season={season}
            episode={episode}
            episodeTitle={ep?.title}
            poster={meta.poster}
            nextEpisode={nextEpisode}
          />
          {ep?.overview && (
            <div className="theater-dim mt-5 rounded-2xl border border-border/50 bg-card/40 p-5">
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                {ep.title || `Episode ${episode}`}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground" dir="auto">
                {ep.overview}
              </p>
            </div>
          )}
        </div>

        {/* the house — episode list dims like cinema lights while the stream
            plays; hover/focus brings them right back */}
        <aside className="theater-dim min-w-0 px-4 sm:px-0">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4 lg:sticky lg:top-20">
            <EpisodePicker meta={meta} imdbId={id} currentSeason={season} currentEpisode={episode} compact />
          </div>
        </aside>
      </div>
    </div>
  );
}
