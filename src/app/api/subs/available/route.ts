import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildSubCacheKey } from "@/lib/subCacheKey";

// ─── GET /api/subs/available?type=&id=&lang=ar&season=&episode= ─────────────
// Instant probe: does a cached track exist for this title? The player calls
// this BEFORE the provider iframe mounts — when it answers yes, the embed URL
// carries sub_url=<our WebVTT> so the provider auto-applies our Arabic track
// natively (English defaults never surface; captions render on the provider's
// own video timeline with zero relay latency).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "series" ? "series" : "movie";
  const imdbId = sp.get("id") ?? "";
  const lang = sp.get("lang") === "en" ? "en" : "ar";
  const season = sp.get("season") ? parseInt(sp.get("season")!, 10) : undefined;
  const episode = sp.get("episode") ? parseInt(sp.get("episode")!, 10) : undefined;

  if (!/^tt\d+/.test(imdbId)) {
    return NextResponse.json({ exists: false, count: 0 }, { status: 400 });
  }

  try {
    const row = await db.subtitleCache.findUnique({
      where: { cacheKey: buildSubCacheKey(type, imdbId, lang, season, episode) },
      select: { count: true, expiresAt: true },
    });
    const exists = !!row && row.count > 0 && row.expiresAt > new Date();
    return NextResponse.json({ exists, count: exists ? row!.count : 0 });
  } catch {
    return NextResponse.json({ exists: false, count: 0 });
  }
}
