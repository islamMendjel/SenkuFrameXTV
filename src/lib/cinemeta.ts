import "server-only";
import type { CatalogResponse, Meta, MetaResponse, MediaType } from "@/types";

// ─── Senku-frameXTV · Cinemeta client (keyless, IMDb-based) ─────────────────
// Cinemeta is Stremio's official metadata engine — no API key required,
// IMDb IDs natively (perfect for embed servers + OpenSubtitles addon).

const CATALOG_BASE = "https://cinemeta-catalogs.strem.io/top/catalog";
const META_BASE = "https://v3-cinemeta.strem.io/meta";
const SEARCH_BASE = "https://v3-cinemeta.strem.io/catalog";

type CacheEntry = { data: unknown; exp: number };
const memory = new Map<string, CacheEntry>();
const TTL = 1000 * 60 * 60; // 1h in-process

async function cachedJSON<T>(url: string, ttlMs = TTL): Promise<T> {
  const hit = memory.get(url);
  if (hit && hit.exp > Date.now()) return hit.data as T;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Cinemeta ${res.status} for ${url}`);
  const data = (await res.json()) as T;
  memory.set(url, { data, exp: Date.now() + ttlMs });
  return data;
}

function normalize(m: Record<string, unknown>, type: MediaType): Meta {
  return {
    imdb_id: (m.imdb_id ?? m.id ?? "") as string,
    type: ((m.type as string) === "series" ? "series" : "movie") as MediaType,
    name: (m.name ?? "") as string,
    poster: (m.poster as string) ?? undefined,
    background: (m.background as string) ?? undefined,
    logo: (m.logo as string) ?? undefined,
    description: (m.description as string) ?? undefined,
    releaseInfo: (m.releaseInfo as string) ?? undefined,
    imdbRating: (m.imdbRating as string) ?? undefined,
    genres: (m.genres as string[]) ?? undefined,
    cast: (m.cast as string[]) ?? undefined,
    director: (m.director as string[]) ?? undefined,
    country: (m.country as string) ?? undefined,
    awards: (m.awards as string) ?? undefined,
    runtime: (m.runtime as string) ?? undefined,
    trailers: (m.trailers as { source: string; type: string }[]) ?? undefined,
    videos: (m.videos as Meta["videos"]) ?? undefined,
    moviedb_id: (m.moviedb_id as number) ?? undefined,
  };
}

// ─── Catalogs ────────────────────────────────────────────────────────────────

export async function getCatalog(
  type: MediaType,
  list: "top" | "popular" = "top",
  genre?: string,
  skip = 0
): Promise<Meta[]> {
  const parts = [genre ? `genre=${encodeURIComponent(genre)}` : "", skip ? `skip=${skip}` : ""]
    .filter(Boolean)
    .join("&");
  const url = parts
    ? `${CATALOG_BASE}/${type}/${list}/${parts}.json`
    : `${CATALOG_BASE}/${type}/${list}.json`;
  const data = await cachedJSON<CatalogResponse>(url);
  return (data.metas ?? []).map((m) => normalize(m as unknown as Record<string, unknown>, type));
}

export async function getTrending(type: MediaType, limit = 20): Promise<Meta[]> {
  return (await getCatalog(type, "top")).slice(0, limit);
}

export async function getTopRated(type: MediaType, limit = 20): Promise<Meta[]> {
  const items = await getCatalog(type, "top");
  return items
    .filter((m) => m.imdbRating && parseFloat(m.imdbRating) >= 7.5)
    .sort((a, b) => parseFloat(b.imdbRating ?? "0") - parseFloat(a.imdbRating ?? "0"))
    .slice(0, limit);
}

export async function getAnime(limit = 20): Promise<Meta[]> {
  const [series, movies] = await Promise.all([
    getCatalog("series", "top", "Animation").catch(() => [] as Meta[]),
    getCatalog("movie", "top", "Animation").catch(() => [] as Meta[]),
  ]);
  return [...series, ...movies].slice(0, limit);
}

// "Arab World" — curated famous Arabic-language titles, resolved by search.
const ARAB_TITLES = [
  "Wadjda",
  "Theeb",
  "Paradise Now",
  "Capernaum",
  "Caramel",
  "The Yacoubian Building",
  "Omar",
  "West Beirut",
  "The Blue Elephant",
  "Ali Zaoua",
  "Incorniciable" /* never matched, dropped silently */,
  "Scheherazade Tell Me a Story",
];

const arabCache: { data: Meta[] | null; exp: number } = { data: null, exp: 0 };

export async function getArabWorld(limit = 14): Promise<Meta[]> {
  if (arabCache.data && arabCache.exp > Date.now()) return arabCache.data.slice(0, limit);
  const results = await Promise.allSettled(
    ARAB_TITLES.slice(0, 12).map((name) => searchMeta(name, "movie"))
  );
  const metas = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((m): m is Meta => !!m);
  // de-dup by imdb id
  const seen = new Set<string>();
  const unique = metas.filter((m) => (seen.has(m.imdb_id) ? false : (seen.add(m.imdb_id), true)));
  arabCache.data = unique;
  arabCache.exp = Date.now() + TTL;
  return unique.slice(0, limit);
}

// ─── Meta & search ───────────────────────────────────────────────────────────

export async function getMeta(type: MediaType, imdbId: string): Promise<Meta | null> {
  try {
    const data = await cachedJSON<MetaResponse>(`${META_BASE}/${type}/${imdbId}.json`);
    if (!data?.meta) return null;
    return normalize(data.meta as unknown as Record<string, unknown>, type);
  } catch {
    return null;
  }
}

export async function searchMeta(query: string, type?: MediaType): Promise<Meta | null> {
  // returns the single best match (used by Arab World curation)
  const types: MediaType[] = type ? [type] : ["series", "movie"];
  for (const t of types) {
    try {
      const data = await cachedJSON<CatalogResponse>(
        `${SEARCH_BASE}/${t}/top/search=${encodeURIComponent(query)}.json`,
        1000 * 60 * 30
      );
      const first = (data.metas ?? [])[0];
      if (first) return normalize(first as unknown as Record<string, unknown>, t);
    } catch {
      /* try next type */
    }
  }
  return null;
}

export async function searchAll(query: string): Promise<Meta[]> {
  const [series, movies] = await Promise.all([
    cachedJSON<CatalogResponse>(`${SEARCH_BASE}/series/top/search=${encodeURIComponent(query)}.json`).catch(
      () => ({ metas: [] }) as CatalogResponse
    ),
    cachedJSON<CatalogResponse>(`${SEARCH_BASE}/movie/top/search=${encodeURIComponent(query)}.json`).catch(
      () => ({ metas: [] }) as CatalogResponse
    ),
  ]);
  const all = [...(series.metas ?? []), ...(movies.metas ?? [])].map((m) =>
    normalize(m as unknown as Record<string, unknown>, (m.type as MediaType) ?? "movie")
  );
  // rank: name startsWith > includes
  const q = query.toLowerCase();
  return all
    .sort((a, b) => {
      const sa = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const sb = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return sa - sb;
    })
    .slice(0, 40);
}
