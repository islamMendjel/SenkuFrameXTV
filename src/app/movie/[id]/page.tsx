import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, getMeta } from "@/lib/cinemeta";
import { WatchMetaBar } from "@/components/WatchMetaBar";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { Row } from "@/components/Row";
import { InfoGrid } from "@/components/InfoGrid";

// ─── /movie/[id] · The Screening Room ────────────────────────────────────────
// Watch-first layout: the Cinema Stage (the player) IS the page hero —
// edge-to-edge under the navbar with the poster's light bleeding out behind
// it. A compact glass meta bar keeps title/rating/list/share in context
// while the stream runs, and everything below the stage dims like house
// lights once playback starts (.theater-dim + data-theater in globals.css).
// The full storyline/cast grid and related rail live below the fold.

export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const meta = await getMeta("movie", id);
  if (!meta) return { title: "Movie" };
  return {
    title: `Watch ${meta.name} (${meta.releaseInfo?.slice(0, 4) ?? ""}) — Arabic subtitles`,
    description: meta.description?.slice(0, 180),
    openGraph: { images: meta.background ? [meta.background] : meta.poster ? [meta.poster] : [] },
  };
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params;
  if (!/^tt\d+/.test(id)) notFound();

  const meta = await getMeta("movie", id);
  if (!meta) notFound();

  const related = await getCatalog("movie", "top", meta.genres?.[0]).catch(() => []);
  const relatedItems = related.filter((m) => m.imdb_id !== id).slice(0, 14);

  return (
    <div className="senku-page-root relative isolate pb-10">
      {/* `isolate` keeps the ambient glow contained; the player's CSS
          fullscreen fallback lifts it via [data-fs-stage] (globals.css). */}
      {/* ambient cinema glow — the poster's light bleeding behind the stage */}
      {(meta.background || meta.poster) && (
        <div aria-hidden className="stage-ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
          <div
            className="stage-ambient-src absolute inset-0 bg-cover bg-top opacity-[0.16] blur-3xl saturate-150"
            style={{ backgroundImage: `url(${meta.background ?? meta.poster})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/75 to-background" />
        </div>
      )}

      {/* ── Cinema Stage — the player is the page hero ── */}
      <section id="watch" className="scroll-mt-16 pt-16">
        <div className="mx-auto max-w-[1600px] px-0 sm:px-6 lg:px-10">
          <StreamPlayer
            key={`${meta.imdb_id}-movie`}
            type="movie"
            imdbId={meta.imdb_id}
            title={meta.name}
            poster={meta.poster}
            runtimeMin={meta.runtime ? parseInt(meta.runtime) || undefined : undefined}
          />
        </div>
      </section>

      {/* ── context bar — always in reach while watching ── */}
      <div className="mx-auto max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-10">
        <WatchMetaBar meta={meta} />
      </div>

      {/* ── the house — dims while the stream plays (Lights-Down) ── */}
      <div className="theater-dim mx-auto max-w-[1600px] px-4 pt-10 sm:px-6 lg:px-10">
        <InfoGrid meta={meta} />
      </div>

      {relatedItems.length > 0 && (
        <div className="theater-dim pt-10">
          <Row titleKey="moreLikeThis" metas={relatedItems} />
        </div>
      )}
    </div>
  );
}
