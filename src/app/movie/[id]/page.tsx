import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalog, getMeta } from "@/lib/cinemeta";
import { DetailsHeader } from "@/components/DetailsHeader";
import { StreamPlayer } from "@/components/player/StreamPlayer";
import { Row } from "@/components/Row";
import { InfoGrid } from "@/components/InfoGrid";

// ─── /movie/[id] · watch page ────────────────────────────────────────────────

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
    <div className="pb-10">
      <DetailsHeader meta={meta} />

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 sm:px-6 lg:px-10">
        <div id="watch" className="scroll-mt-20 pt-2">
          <StreamPlayer
            type="movie"
            imdbId={meta.imdb_id}
            title={meta.name}
            poster={meta.poster}
            runtimeMin={meta.runtime ? parseInt(meta.runtime) || undefined : undefined}
          />
        </div>

        <InfoGrid meta={meta} />
      </div>

      {relatedItems.length > 0 && (
        <div className="pt-10">
          <Row titleKey="moreLikeThis" metas={relatedItems} />
        </div>
      )}
    </div>
  );
}
