// ─── Senku-frameXTV · per-episode subtitle sync memory ───────────────────────
// Every episode is a different source file with its own sync personality:
// a +0.3s fix on S8E21 must not poison S8E22. Offsets are stored per
// imdb+season+episode (movies per imdb) and survive reloads/restarts.

const PREFIX = "senku.suboffset";
const LIMIT = 30; // ±30s sanity clamp

export type SubOffsetScope = {
  type: "series" | "movie";
  imdbId: string;
  season?: number;
  episode?: number;
};

export function subOffsetKey({ type, imdbId, season, episode }: SubOffsetScope): string {
  return type === "series" && season && episode
    ? `${PREFIX}:${imdbId}:s${season}e${episode}`
    : `${PREFIX}:${imdbId}:movie`;
}

/** Stored offset for this exact episode/movie, or null when never tuned. */
export function readSubOffset(scope: SubOffsetScope): number | null {
  try {
    const raw = localStorage.getItem(subOffsetKey(scope));
    if (raw === null) return null;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? Math.max(-LIMIT, Math.min(LIMIT, Math.round(v * 10) / 10)) : null;
  } catch {
    return null;
  }
}

/** Persist the offset (null clears the override → global default applies). */
export function writeSubOffset(scope: SubOffsetScope, value: number | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(subOffsetKey(scope));
    } else {
      localStorage.setItem(subOffsetKey(scope), String(Math.round(value * 10) / 10));
    }
  } catch {
    /* private mode — session-only nudges still work in memory */
  }
}
