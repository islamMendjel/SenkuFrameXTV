import { NextRequest, NextResponse } from "next/server";
import { getMeta } from "@/lib/cinemeta";
import type { MediaType } from "@/types";

// ─── GET /api/meta?type=movie|series&id=tt… ──────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") === "series" ? "series" : "movie") as MediaType;
  const id = sp.get("id") ?? "";
  if (!/^tt\d+/.test(id)) {
    return NextResponse.json({ meta: null, error: "invalid id" }, { status: 400 });
  }
  const meta = await getMeta(type, id);
  if (!meta) return NextResponse.json({ meta: null }, { status: 404 });
  return NextResponse.json(
    { meta },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
