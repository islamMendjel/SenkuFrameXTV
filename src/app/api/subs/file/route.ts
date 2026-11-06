import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildSubCacheKey } from "@/lib/subCacheKey";
import { shiftCues } from "@/lib/subCalibration";
import type { SubtitleCue } from "@/types";

// ─── GET /api/subs/file?type=&id=&lang=ar&season=&episode= ──────────────────
// Serves a cached track as WebVTT for provider-native playback. VidSrc and
// SuperEmbed players accept sub_url=<https VTT> and auto-apply it: the
// provider's own video timeline renders our Arabic cues with zero relay
// latency, and the captions live inside the video — so every fullscreen mode
// (ours, the provider's, even CSS fakes) keeps them on screen.
// CORS is required: the file is fetched by the PROVIDER iframe running in the
// viewer's browser, cross-origin to us (official VidSrc contract).
export const dynamic = "force-dynamic";

function vttTime(t: number): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3_600_000), 2)}:${pad(
    Math.floor((ms % 3_600_000) / 60_000),
    2
  )}:${pad(Math.floor((ms % 60_000) / 1000), 2)}.${pad(ms % 1000, 3)}`;
}

function cuesToVtt(cues: SubtitleCue[]): string {
  const calibrated = shiftCues(cues); // global release-offset calibration
  const out: string[] = ["WEBVTT", ""];
  calibrated.forEach((c, i) => {
    const text = c.text.replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim();
    if (!text) return;
    out.push(String(i + 1));
    out.push(`${vttTime(c.start)} --> ${vttTime(Math.max(c.end, c.start + 0.2))}`);
    out.push(text);
    out.push("");
  });
  return out.join("\n");
}

const VTT_HEADERS: Record<string, string> = {
  "Content-Type": "text/vtt; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "series" ? "series" : "movie";
  const imdbId = sp.get("id") ?? "";
  const lang = sp.get("lang") === "en" ? "en" : "ar";
  const season = sp.get("season") ? parseInt(sp.get("season")!, 10) : undefined;
  const episode = sp.get("episode") ? parseInt(sp.get("episode")!, 10) : undefined;

  if (!/^tt\d+/.test(imdbId)) {
    // 404 (CORS headers kept) → the provider simply skips the custom track
    return new Response("not found", { headers: VTT_HEADERS, status: 404 });
  }

  try {
    const row = await db.subtitleCache.findUnique({
      where: { cacheKey: buildSubCacheKey(type, imdbId, lang, season, episode) },
    });
    if (!row || row.expiresAt < new Date()) {
      return new Response("not found", { headers: VTT_HEADERS, status: 404 });
    }
    const cues = JSON.parse(row.cuesJson) as SubtitleCue[];
    if (!Array.isArray(cues) || cues.length === 0) {
      return new Response("not found", { headers: VTT_HEADERS, status: 404 });
    }
    return new Response(cuesToVtt(cues), { headers: VTT_HEADERS, status: 200 });
  } catch {
    return new Response("not found", { headers: VTT_HEADERS, status: 404 });
  }
}
