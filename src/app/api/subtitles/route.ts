import { NextRequest, NextResponse } from "next/server";
import { parseSubtitles, decodeSubtitleBuffer } from "@/lib/subParser";
import { fetchBestSrt } from "@/lib/subtitlecat";
import { translateCues } from "@/lib/llmTranslate";
import { db } from "@/lib/db";
import { getMeta } from "@/lib/cinemeta";
import { buildSubCacheKey } from "@/lib/subCacheKey";
import { shiftCues } from "@/lib/subCalibration";
import type { SubtitleCue, SubtitleTrackInfo } from "@/types";

// ─── GET /api/subtitles?type=&id=&lang=ar|en&season=&episode= ────────────────
// Chain:
//   0. DB cache (SubtitlesCache) — instant for pre-warmed/translated tracks
//   1. OPENSUBTITLES_API_KEY official API (optional env)
//   2. OpenSubtitles v3 Stremio addon — keyless, human-authored
//   3. SubtitleCat release-matched English srt:
//        lang=en → parse directly
//        lang=ar → LLM batch-translation in a background job
//                  (client polls: { pending: true, progress, cues? })
//                  → pending polls also carry the synced ENGLISH cues as an
//                    interim track, so viewers read captions while the Arabic
//                    translation cooks; final AR cues hot-swap in.
// Response: { lang, count, cues, source } | { pending, progress, cues? }

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

const DB_TTL_DAYS = 30;

// ── memory caches ──
const memCache = new Map<string, { exp: number; payload: unknown }>();
const MEM_TTL = 1000 * 60 * 60 * 6;
const memNegative = new Map<string, { exp: number }>();
const NEG_TTL = 1000 * 60 * 10;

// ── background translation jobs (server-lifetime) ──
interface SubJob {
  status: "running" | "done" | "error";
  progress: number; // 0..1
  startedAt: number;
  /** synced English cues served while the Arabic translation runs */
  interimCues?: SubtitleCue[];
}
declare global {
  // module-scope Map shared across HMR rebuilds (survives route re-eval)
  var __senkuSubJobs: Map<string, SubJob> | undefined;
}
const jobs: Map<string, SubJob> =
  (globalThis.__senkuSubJobs as Map<string, SubJob>) ??
  (globalThis.__senkuSubJobs = new Map<string, SubJob>());

// Translation-engine version lives in @/lib/subCacheKey (shared with the
// provider-native /api/subs/* endpoints so every surface agrees on keys).

// ── serve-time calibration ──
// Every cue payload leaving this route passes through shiftCues(): the raw
// cache stays untouched, while native + overlay surfaces get the globally
// calibrated timeline (release-offset fix, see lib/subCalibration.ts).
function calibrated<T extends { cues?: SubtitleCue[] }>(payload: T): T {
  if (!payload.cues || payload.cues.length === 0) return payload;
  return { ...payload, cues: shiftCues(payload.cues) };
}

// ── source 1: official OpenSubtitles API (needs env key) ──
async function viaOfficialApi(
  type: string,
  imdbId: string,
  lang: string,
  season?: number,
  episode?: number
): Promise<{ cues: SubtitleCue[]; track: SubtitleTrackInfo } | null> {
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
    // charset-aware decode (Arabic SRTs are often Windows-1256)
    const raw = decodeSubtitleBuffer(await srtRes.arrayBuffer());
    const cues = parseSubtitles(raw);
    if (cues.length < 5) return null;
    return { cues, track: { id: String(fileId), lang, url: dlData.link } };
  } catch {
    return null;
  }
}

// ── source 2: OpenSubtitles v3 Stremio addon ──
async function viaAddon(
  type: string,
  imdbId: string,
  lang: string,
  season?: number,
  episode?: number
): Promise<{ cues: SubtitleCue[]; track: SubtitleTrackInfo } | null> {
  try {
    const wanted = LANG_MAP[lang] ?? LANG_MAP.en;
    const qs = new URLSearchParams();
    if (type === "series") {
      if (season) qs.set("season", String(season));
      if (episode) qs.set("episode", String(episode));
    }
    const url = `${ADDON_BASE}/${type}/${imdbId}.json${qs.size ? `?${qs}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { subtitles?: AddonSub[] };
    const tracks = data.subtitles ?? [];
    let pool = tracks.filter((t) => wanted.includes(t.lang));
    if (type === "series" && season && episode && pool.length > 0) {
      const exact = pool.filter((t) => t.season === season && t.episode === episode);
      if (exact.length > 0) pool = exact;
    }
    if (pool.length === 0) return null;

    const score = (s: AddonSub): number => {
      const fmt = (s.movieReleaseName ?? "").toLowerCase();
      let sc = 0;
      if (/\b(bluray|blu-ray|bdrip|web-?dl|webrip|nf |amzn)\b/.test(fmt)) sc += 60;
      if (/\b(hdtv|web)\b/.test(fmt)) sc += 30;
      if (/\b(cam|ts|telesync|screener)\b/.test(fmt)) sc -= 50;
      if (s.SubEncoding === "UTF-8") sc += 15;
      return sc;
    };

    const ranked = [...pool].sort((a, b) => score(b) - score(a));
    for (const track of ranked.slice(0, 3)) {
      try {
        const r = await fetch(track.url, { cache: "no-store" });
        if (!r.ok) continue;
        const raw = decodeSubtitleBuffer(await r.arrayBuffer());
        const cues = parseSubtitles(raw);
        if (cues.length >= 5) {
          return {
            cues,
            track: {
              id: track.id,
              lang: track.lang,
              url: track.url,
              fileName: track.subtitleFileName,
              encoding: track.SubEncoding,
              releaseName: track.movieReleaseName,
            },
          };
        }
      } catch {
        /* next */
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── source 3: SubtitleCat (English base) ──
async function viaSubtitleCat(
  metaName: string,
  type: string,
  season?: number,
  episode?: number
): Promise<{ cues: SubtitleCue[]; release: string } | null> {
  try {
    const hit = await fetchBestSrt(metaName, type === "series" ? season : undefined, type === "series" ? episode : undefined);
    if (!hit) return null;
    const cues = parseSubtitles(hit.srt);
    if (cues.length < 5) return null;
    return { cues, release: hit.release };
  } catch {
    return null;
  }
}

// ── background Arabic translation job ──
async function runTranslationJob(
  cacheKey: string,
  metaName: string,
  type: string,
  imdbId: string,
  season?: number,
  episode?: number
): Promise<void> {
  const job = jobs.get(cacheKey)!;
  try {
    const base = await viaSubtitleCat(metaName, type, season, episode);
    if (!base) {
      job.status = "error";
      return;
    }
    const translated = await translateCues(base.cues, "Arabic (Modern Standard, natural spoken style)", (p) => {
      job.progress = Math.min(0.95, p.done / Math.max(1, p.total));
    });
    // persist to DB
    try {
      await db.subtitleCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          lang: "ar",
          count: translated.length,
          source: `ai-translate:${base.release}`,
          cuesJson: JSON.stringify(translated),
          expiresAt: new Date(Date.now() + DB_TTL_DAYS * 86400_000),
        },
        update: {
          count: translated.length,
          source: `ai-translate:${base.release}`,
          cuesJson: JSON.stringify(translated),
          expiresAt: new Date(Date.now() + DB_TTL_DAYS * 86400_000),
        },
      });
    } catch {
      /* db is best-effort; memory below still serves this session */
    }
    memCache.set(cacheKey, {
      exp: Date.now() + MEM_TTL,
      payload: {
        lang: "ar",
        count: translated.length,
        cues: translated,
        source: "ai-translate",
      },
    });
    job.progress = 1;
    job.status = "done";
  } catch {
    job.status = "error";
  }
}

// ── DB helpers ──
async function readDb(cacheKey: string) {
  try {
    const row = await db.subtitleCache.findUnique({ where: { cacheKey } });
    if (!row || row.expiresAt < new Date()) return null;
    const cues = JSON.parse(row.cuesJson) as SubtitleCue[];
    if (!Array.isArray(cues) || cues.length === 0) return null;
    return { count: row.count, cues, source: row.source };
  } catch {
    return null;
  }
}

async function writeDb(
  cacheKey: string,
  lang: string,
  cues: SubtitleCue[],
  source: string
) {
  try {
    await db.subtitleCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        lang,
        count: cues.length,
        source,
        cuesJson: JSON.stringify(cues),
        expiresAt: new Date(Date.now() + DB_TTL_DAYS * 86400_000),
      },
      update: {
        count: cues.length,
        source,
        cuesJson: JSON.stringify(cues),
        expiresAt: new Date(Date.now() + DB_TTL_DAYS * 86400_000),
      },
    });
  } catch {
    /* best-effort */
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

  const cacheKey = buildSubCacheKey(type, imdbId, lang, season, episode);

  // 0a. memory
  const hit = memCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return NextResponse.json(calibrated(hit.payload));

  // 0b. running translation job → report progress (+ interim English cues)
  const job = jobs.get(cacheKey);
  if (job && job.status === "running") {
    return NextResponse.json(
      calibrated({
        pending: true,
        progress: job.progress,
        lang,
        interim: job.interimCues ? true : undefined,
        cues: job.interimCues,
        count: job.interimCues?.length,
      })
    );
  }

  // 0c. DB
  const dbRow = await readDb(cacheKey);
  if (dbRow) {
    // RAW cues go into memCache — calibration happens at the response edge
    // (0a re-calibrates), never inside the cache (would double-shift)
    const payload = { lang, count: dbRow.count, cues: dbRow.cues, source: dbRow.source };
    memCache.set(cacheKey, { exp: Date.now() + MEM_TTL, payload });
    return NextResponse.json(calibrated(payload));
  }

  // 0d. recent negative → don't hammer sources
  const neg = memNegative.get(cacheKey);
  if (neg && neg.exp > Date.now()) {
    return NextResponse.json({ lang, count: 0, cues: [], source: "none" });
  }

  // 1. official API
  let result = await viaOfficialApi(type, imdbId, lang, season, episode).catch(() => null);
  if (result) {
    const payload = calibrated({ lang, count: result.cues.length, cues: result.cues, source: "opensubtitles-api" });
    memCache.set(cacheKey, { exp: Date.now() + MEM_TTL, payload: { ...payload, cues: result.cues } });
    writeDb(cacheKey, lang, result.cues, "opensubtitles-api");
    return NextResponse.json(payload);
  }

  // 2. v3 addon
  result = await viaAddon(type, imdbId, lang, season, episode).catch(() => null);
  if (result) {
    const payload = calibrated({
      lang,
      count: result.cues.length,
      cues: result.cues,
      source: "opensubtitles-addon",
    });
    memCache.set(cacheKey, { exp: Date.now() + MEM_TTL, payload: { ...payload, cues: result.cues } });
    writeDb(cacheKey, lang, result.cues, "opensubtitles-addon");
    return NextResponse.json(payload);
  }

  // 3. SubtitleCat
  const meta = await getMeta(type, imdbId).catch(() => null);
  const metaName = meta?.name;
  if (metaName) {
    const scBase = await viaSubtitleCat(metaName, type, season, episode).catch(() => null);
    if (scBase) {
      if (lang === "en") {
        const payload = calibrated({
          lang,
          count: scBase.cues.length,
          cues: scBase.cues,
          source: `subtitlecat:${scBase.release}`,
        });
        memCache.set(cacheKey, { exp: Date.now() + MEM_TTL, payload: { ...payload, cues: scBase.cues } });
        writeDb(cacheKey, lang, scBase.cues, `subtitlecat:${scBase.release}`);
        return NextResponse.json(payload);
      }
      // Arabic → launch background AI translation, report pending.
      // Carry the synced English cues on every poll so the viewer has
      // captions NOW; the finished Arabic track hot-swaps in when ready.
      const running: SubJob = {
        status: "running",
        progress: 0,
        startedAt: Date.now(),
        interimCues: scBase.cues,
      };
      jobs.set(cacheKey, running);
      void runTranslationJob(cacheKey, metaName, type, imdbId, season, episode).finally(() => {
        // auto-clean finished/errored jobs after 10 min
        setTimeout(() => {
          const j = jobs.get(cacheKey);
          if (j && j.status !== "running") jobs.delete(cacheKey);
        }, 600_000);
      });
      return NextResponse.json(
        calibrated({
          pending: true,
          progress: 0,
          lang,
          interim: true,
          cues: scBase.cues,
          count: scBase.cues.length,
        })
      );
    }
  }

  // 4. nothing found
  memNegative.set(cacheKey, { exp: Date.now() + NEG_TTL });
  return NextResponse.json({ lang, count: 0, cues: [], source: "none" });
}
