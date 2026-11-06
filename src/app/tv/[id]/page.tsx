import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCatalog, getMeta } from "@/lib/cinemeta";
import { DetailsHeader } from "@/components/DetailsHeader";
import { EpisodePicker } from "@/components/EpisodePicker";
import { Row } from "@/components/Row";
import { InfoGrid } from "@/components/InfoGrid";
import { Play } from "lucide-react";

// ─── /tv/[id] · series details + episode picker ──────────────────────────────

export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const meta = await getMeta("series", id);
  if (!meta) return { title: "Series" };
  return {
    title: `Watch ${meta.name} — Arabic subtitles`,
    description: meta.description?.slice(0, 180),
    openGraph: { images: meta.background ? [meta.background] : meta.poster ? [meta.poster] : [] },
  };
}

export default async function TvPage({ params }: Props) {
  const { id } = await params;
  if (!/^tt\d+/.test(id)) notFound();

  const meta = await getMeta("series", id);
  if (!meta) notFound();

  const firstEp = meta.videos?.[0];
  const watchHref =
    firstEp ? `/tv/${id}/${firstEp.season}/${firstEp.episode}` : "#watch";

  const related = await getCatalog("series", "top", meta.genres?.[0]).catch(() => []);
  const relatedItems = related.filter((m) => m.imdb_id !== id).slice(0, 14);

  return (
    <div className="pb-10">
      <DetailsHeader meta={meta} watchHref={watchHref} />

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 sm:px-6 lg:px-10">
        <div className="grid min-w-0 gap-8 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <div id="watch" className="scroll-mt-20">
              <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-zinc-950">
                <Link
                  href={watchHref}
                  className="flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-black text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all hover:scale-105"
                >
                  <Play className="h-4 w-4 fill-black" aria-hidden />
                  {firstEp ? `S${firstEp.season} · E${firstEp.episode}` : ""}
                </Link>
              </div>
            </div>
            <div className="mt-8">
              <InfoGrid meta={meta} />
            </div>
          </div>

          <aside className="min-w-0 rounded-2xl border border-border/50 bg-card/40 p-4">
            <EpisodePicker meta={meta} imdbId={id} compact />
          </aside>
        </div>
      </div>

      {relatedItems.length > 0 && (
        <div className="pt-10">
          <Row titleKey="moreLikeThis" metas={relatedItems} />
        </div>
      )}
    </div>
  );
}
