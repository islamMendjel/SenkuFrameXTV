import { NextRequest, NextResponse } from "next/server";
import { parseSubtitles } from "@/lib/subParser";
import type { SubtitleTrackInfo } from "@/types";

// ─── GET /api/subtitles?type=&id=&lang=ar|en&season=&episode= ────────────────
// Provider chain:
//  1. OpenSubtitles v3 addon (Stremio) — keyless, UTF-8 enforced, Arabic-rich
//  2. OPENSUBTITLES_API_KEY (optional env) — official REST API, best quality
// Returns normalized { start, end, text } cues ready for the overlay engine.

export const dynamic = "force-dynamic";

const ADDON_BASE = "https://opensubtitles-v3.strem.io/subtitles";
const LANG_MAP: Record<string, string[]> = {
  ar: ["ara", "ar", "arabic"],
  en: ["eng", "en", "english"],
};

interface AddonSub {
  id: string;
  url: string;
  lang: string;
  SubEncoding?: string;
  subtitleFileName?: string;
  movieReleaseName?: string;
  season?: number;
  episode?: number;
}

const cueCache = new Map<string, { exp: number; payload: unknown }>();
const TTL = 1000 * 60 * 60 * 6;

async function fetchAddonTracks(
  type: string,
  imdbId: string,
  season?: number,
  episode?: number
): Promise<AddonSub[]> {
  const qs = new URLSearchParams();
  if (type === "series") {
    if (season) qs.set("season", String(season));
    if (episode) qs.set("episode", String(episode));
  }
  const url = `${ADDON_BASE}/${type}/${imdbId}.json${qs.size ? `?${qs}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`addon ${res.status}`);
  const data = (await res.json()) as { subtitles?: AddonSub[] };
  return data.subtitles ?? [];
}

function scoreTrack(s: AddonSub): number {
  let score = 0;
  const fmt = (s.movieReleaseName ?? "").toLowerCase();
  if (/\b(bluray|blu-ray|bdrip|web-?dl|webrip|nf |amzn)\b/.test(fmt)) score += 60;
  if (/\b(hdtv|web)\b/.test(fmt)) score += 30;
  if (/\b(cam|ts|telesync|screener|dvdscr)\b/.test(fmt)) score -= 50;
  if (s.SubEncoding === "UTF-8") score += 15;
  if (/[\u0600-\u06FF]/.test(s.subtitleFileName ?? "")) score += 5; // arabic filename bonus
  if (s.subtitleFileName?.includes(".")) score += 0;
  return score;
}

async function downloadAndParse(track: AddonSub): Promise<{ cues: ReturnType<typeof parseSubtitles> }> {
  const res = await fetch(track.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`subtitle download ${res.status}`);
  // server sends text (subencoding-stremio-utf8 path → already UTF-8)
  const raw = await res.text();
  return { cues: parseSubtitles(raw) };
}

async function viaAddon(
  type: string,
  imdbId: string,
  lang: string,
  season?: number,
  episode?: number
) {
  const wanted = LANG_MAP[lang] ?? LANG_MAP.en;
  let tracks = await fetchAddonTracks(type, imdbId, season, episode);

  // Strict episode match first (series), then relax
  let langTracks = tracks.filter((t) => wanted.includes(t.lang));
  if (type === "series" && season && episode && langTracks.length > 0) {
    const exact = langTracks.filter((t) => t.season === season && t.episode === episode);
    if (exact.length > 0) langTracks = exact;
  }

  const pool = langTracks.length > 0 ? langTracks : tracks.filter((t) => wanted.includes(t.lang));
  if (pool.length === 0) return null;

  const ranked = [...pool].sort((a, b) => scoreTrack(b) - scoreTrack(a));

  // try top 3 tracks until one parses with a decent cue count
  for (const track of ranked.slice(0, 3)) {
    try {
      const { cues } = await downloadAndParse(track);
      if (cues.length >= 5) {
        const info: SubtitleTrackInfo = {
          id: track.id,
          lang: track.lang,
          url: track.url,
          fileName: track.subtitleFileName,
          encoding: track.SubEncoding,
          releaseName: track.movieReleaseName,
        };
        return { track: info, cues };
      }
    } catch {
      /* next candidate */
    }
  }
  return null;
}

async function viaOfficialApi(
  type: string,
  imdbId: string,
  lang: string,
  season?: number,
  episode?: number
) {
  const key = process.env.OPENSUBTITLES_API_KEY;
  if (!key) return null;
  try {
    const qs = new URLSearchParams({
      imdb_id: imdbId.replace("tt", ""),
      languages: lang === "ar" ? "ar" : "en",
    });
    if (type === "series") {
      if (season) qs.set("season_number", String(season));
      if (episode) qs.set("episode_number", String(episode));
    }
    const res = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${qs}`, {
      headers: { "Api-Key": key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { attributes?: { files?: { file_id: number }[] } }[];
    };
    const first = data.data?.[0];
    const fileId = first?.attributes?.files?.[0]?.file_id;
    if (!fileId) return null;
    const dl = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: { "Api-Key": key, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!dl.ok) return null;
    const dlData = (await dl.json()) as { link?: string };
    if (!dlData.link) return null;
    const srtRes = await fetch(dlData.link, { cache: "no-store" });
    const raw = await srtRes.text();
    return { track: { id: String(fileId), lang, url: dlData.link }, cues: parseSubtitles(raw) };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "series" ? "series" : "movie";
  const imdbId = sp.get("id") ?? "";
  const lang = sp.get("lang") === "en" ? "en" : "ar";
  const season = sp.get("season") ? parseInt(sp.get("season")!, 10) : undefined;
  const episode = sp.get("episode") ? parseInt(sp.get("episode")!, 10) : undefined;

  if (!/^tt\d+/.test(imdbId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const cacheKey = `${imdbId}:${type}:${lang}:${season ?? 0}:${episode ?? 0}`;
  const hit = cueCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) {
    return NextResponse.json(hit.payload);
  }

  let result: { track: SubtitleTrackInfo; cues: ReturnType<typeof parseSubtitles> } | null = null;

  try {
    result = await viaOfficialApi(type, imdbId, lang, season, episode);
  } catch {
    /* ignore, fall through */
  }
  if (!result) {
    try {
      result = await viaAddon(type, imdbId, lang, season, episode);
    } catch {
      /* ignore */
    }
  }

  const payload = result
    ? {
        lang,
        track: result.track,
        cues: result.cues,
        count: result.cues.length,
        source: "opensubtitles-addon" as const,
      }
    : { lang, track: null, cues: [], count: 0, source: "none" as const };

  cueCache.set(cacheKey, { exp: Date.now() + TTL, payload });
  return NextResponse.json(payload);
}
