// ─── Senku-frameXTV · Global types ───────────────────────────────────────────

export type MediaType = "movie" | "series";
export type UILang = "en" | "ar";
export type SubLang = "ar" | "en" | "off";

export interface Meta {
  imdb_id: string;
  type: MediaType;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  genres?: string[];
  cast?: string[];
  director?: string[];
  country?: string;
  awards?: string;
  runtime?: string;
  trailers?: { source: string; type: string }[];
  videos?: EpisodeVideo[];
  moviedb_id?: number;
  popularities?: Record<string, number>;
}

export interface EpisodeVideo {
  id: string;
  title?: string;
  name?: string;
  season: number;
  episode: number;
  released?: string;
  overview?: string;
  thumbnail?: string;
  description?: string;
}

export interface CatalogResponse {
  metas: Meta[];
}

export interface MetaResponse {
  meta: Meta | null;
}

export interface SubtitleCue {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface SubtitleTrackInfo {
  id: string;
  lang: string;
  url: string;
  fileName?: string;
  encoding?: string;
  releaseName?: string;
}

export interface SubtitlePayload {
  lang: string;
  track: SubtitleTrackInfo | null;
  cues: SubtitleCue[];
  source: "opensubtitles-addon" | "none";
  count: number;
}

// ─── App state ───────────────────────────────────────────────────────────────

export interface WatchlistItem {
  imdbId: string;
  type: MediaType;
  title: string;
  poster?: string;
  year?: string;
  rating?: string;
  addedAt: number;
}

export interface HistoryEntry {
  imdbId: string;
  type: MediaType;
  title: string;
  poster?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  progressPct: number;
  updatedAt: number;
}

// Options the player can pass when building a provider embed URL.
export interface ServerBuildOpts {
  /** https URL of our cached track (WebVTT) — injected as the provider's
   *  auto-applied external subtitle (VidSrc sub_url / SuperEmbed sub_url). */
  subUrl?: string;
}

export interface ServerDef {
  id: string;
  name: string;
  tag?: string;
  quality: string;
  build: (
    type: MediaType,
    imdbId: string,
    season?: number,
    episode?: number,
    opts?: ServerBuildOpts
  ) => string;
  /** Provider accepts an external auto-applied subtitle track → the player
   *  probes /api/subs/available and injects our Arabic VTT when cached. */
  nativeSubs?: boolean;
}
