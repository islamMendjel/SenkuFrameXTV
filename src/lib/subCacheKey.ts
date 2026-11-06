// ─── Shared subtitle cache key ──────────────────────────────────────────────
// One builder for every subtitle surface (/api/subtitles, /api/subs/available,
// /api/subs/file) so the provider-native track endpoints always agree with
// the main pipeline on where a track lives.

// Translation-engine version — bump to invalidate stale AI translations.
// t4 → current repair engine. Only applies to the AI-translated 'ar' lane;
// human EN tracks are release-matched, not generated.
export const AR_TRANSLATION_VERSION = "t4";

export function buildSubCacheKey(
  type: string,
  imdbId: string,
  lang: string,
  season?: number,
  episode?: number
): string {
  const langTag = lang === "ar" ? `ar@${AR_TRANSLATION_VERSION}` : "en";
  return `${imdbId}:${type}:${langTag}:${season ?? 0}:${episode ?? 0}`;
}
