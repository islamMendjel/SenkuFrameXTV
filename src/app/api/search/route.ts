import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/cinemeta";
import { englishFromArabic } from "@/lib/i18n";

// ─── GET /api/search?q=… ─────────────────────────────────────────────────────
// Accepts English and Arabic queries (Arabic hits the curated dictionary first).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (raw.length < 2) return NextResponse.json({ metas: [] });
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  const translated = hasArabic ? englishFromArabic(raw) : undefined;
  try {
    let metas = await searchAll(translated ?? raw);
    if (metas.length === 0 && translated) metas = await searchAll(raw);
    return NextResponse.json(
      { metas },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
    );
  } catch (e) {
    return NextResponse.json(
      { metas: [], error: e instanceof Error ? e.message : "search failed" },
      { status: 502 }
    );
  }
}
