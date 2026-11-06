import { NextRequest, NextResponse } from "next/server";
import { getAnime, getArabWorld, getCatalog, getTopRated, getTrending } from "@/lib/cinemeta";
import type { MediaType } from "@/types";

// ─── GET /api/catalog?type=movie|series&list=top|popular&genre=&section= ─────
// section shortcuts: trending | top | anime | arab

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") === "series" ? "series" : "movie") as MediaType;
  const section = sp.get("section");
  const genre = sp.get("genre") ?? undefined;
  const limit = Math.min(parseInt(sp.get("limit") ?? "20", 10) || 20, 50);

  try {
    let metas;
    switch (section) {
      case "trending":
        metas = await getTrending(type, limit);
        break;
      case "top":
        metas = await getTopRated(type, limit);
        break;
      case "anime":
        metas = await getAnime(limit);
        break;
      case "arab":
        metas = await getArabWorld(limit);
        break;
      default:
        metas = await getCatalog(type, "top", genre, 0);
    }
    return NextResponse.json(
      { metas },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (e) {
    return NextResponse.json(
      { metas: [], error: e instanceof Error ? e.message : "catalog failed" },
      { status: 502 }
    );
  }
}
