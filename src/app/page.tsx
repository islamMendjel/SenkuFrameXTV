import { getAnime, getArabWorld, getCatalog, getTopRated, getTrending } from "@/lib/cinemeta";
import { HeroBanner } from "@/components/HeroBanner";
import { Row } from "@/components/Row";
import { ContinueWatching } from "@/components/ContinueWatching";
import { Flame, Sparkles, Trophy, Clapperboard, TrendingUp } from "lucide-react";

// ─── Home · hero carousel + curated cinematic rows ───────────────────────────
// Server-rendered data (keyless Cinemeta), client interactivity in components.

export const revalidate = 3600;

export default async function HomePage() {
  const [heroPool, trendingMovies, trendingSeries, topMovies, arab, anime] = await Promise.all([
    getTrending("movie", 12).catch(() => []),
    getTrending("movie", 20).catch(() => []),
    getTrending("series", 20).catch(() => []),
    getTopRated("movie", 20).catch(() => []),
    getArabWorld(14).catch(() => []),
    getAnime(20).catch(() => []),
  ]);

  const heroPicks = [...heroPool].sort(() => Math.random() - 0.4).slice(0, 5);

  return (
    <div className="space-y-10 pb-8">
      <HeroBanner metas={heroPicks.length > 0 ? heroPicks : heroPool.slice(0, 5)} />

      <div className="space-y-10">
        <ContinueWatching />

        <Row
          titleKey="trendingNow"
          metas={trendingMovies}
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
        />

        <Row
          titleKey="trendingSeries"
          metas={trendingSeries}
          icon={<Sparkles className="h-5 w-5" aria-hidden />}
        />

        <Row
          titleKey="arabWorld"
          id="arab-world"
          metas={arab}
          icon={<Flame className="h-5 w-5" aria-hidden />}
        />

        <Row
          titleKey="topRated"
          metas={topMovies}
          icon={<Trophy className="h-5 w-5" aria-hidden />}
        />

        <Row
          titleKey="anime"
          metas={anime}
          icon={<Clapperboard className="h-5 w-5" aria-hidden />}
        />
      </div>
    </div>
  );
}
