import { NextResponse } from "next/server";

// ─── GET /api/version · build fingerprint for stale-tab auto-recovery ────────
// The client pings this periodically. When the server has restarted (new code
// deployed) the fingerprint changes and long-lived tabs reload themselves.

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __SENKU_BOOT_TS?: string };

if (!g.__SENKU_BOOT_TS) {
  g.__SENKU_BOOT_TS = Date.now().toString(36);
}

export async function GET() {
  return NextResponse.json(
    { v: g.__SENKU_BOOT_TS },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
