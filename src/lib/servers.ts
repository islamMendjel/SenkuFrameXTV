import type { MediaType, ServerDef } from "@/types";

// ─── Senku-frameXTV · Multi-server fallback registry ────────────────────────
// All providers are keyed on IMDb IDs (tt…).
//
// ORDER MATTERS. Verified behaviour:
//  - VidSrc.to renders real player content and only soft-gates playback with
//    a client check that passes on normal residential connections.
//  - frameXTV's embed exhausts its internal "failover budget" on dead streams
//    and drops into its VidUP backup player, which brick-walls behind a
//    "Please Disable Sandbox" screen (its own PDF-plugin probe — nothing to
//    do with our iframe). So frameXTV ships LAST as a manual fallback only.

export const SERVERS: ServerDef[] = [
  {
    id: "vidsrc-to",
    name: "VidSrc",
    tag: "Alpha",
    quality: "1080p",
    build: (type, imdbId, season, episode) =>
      type === "movie"
        ? `https://vidsrc.to/embed/movie/${imdbId}`
        : `https://vidsrc.to/embed/tv/${imdbId}/${season ?? 1}/${episode ?? 1}`,
  },
  {
    id: "vidsrc-icu",
    name: "VidSrc",
    tag: "Beta",
    quality: "1080p",
    build: (type, imdbId, season, episode) =>
      type === "movie"
        ? `https://vidsrc.icu/embed/movie/${imdbId}`
        : `https://vidsrc.icu/embed/tv/${imdbId}/${season ?? 1}/${episode ?? 1}`,
  },
  {
    id: "multiembed",
    name: "SuperEmbed",
    tag: "Multi",
    quality: "Multi-Qual",
    build: (type, imdbId, season, episode) =>
      type === "movie"
        ? `https://multiembed.mov/?video_id=${imdbId}`
        : `https://multiembed.mov/?video_id=${imdbId}&s=${season ?? 1}&e=${episode ?? 1}`,
  },
  {
    id: "twoembed",
    name: "2Embed",
    tag: "Reserve",
    quality: "720p+",
    build: (type, imdbId, season, episode) =>
      type === "movie"
        ? `https://www.2embed.cc/embed/${imdbId}`
        : `https://www.2embed.cc/embedtv/${imdbId}&s=${season ?? 1}&e=${episode ?? 1}`,
  },
  {
    id: "vidlink",
    name: "VidLink",
    tag: "Nova",
    quality: "1080p",
    build: (type, imdbId, season, episode) =>
      type === "movie"
        ? `https://vidlink.pro/movie/${imdbId}`
        : `https://vidlink.pro/tv/${imdbId}/${season ?? 1}/${episode ?? 1}`,
  },
  {
    id: "framextv",
    name: "frameXTV",
    tag: "Barbarian",
    quality: "4K · HDR",
    build: (type, imdbId, season, episode) =>
      type === "movie"
        ? `https://framextv.cc/embed/movie/${imdbId}?autoplay=1`
        : `https://framextv.cc/embed/tv/${imdbId}/${season ?? 1}/${episode ?? 1}?autoplay=1`,
  },
  {
    id: "framextv-archer",
    name: "frameXTV",
    tag: "Archer",
    quality: "4K · HDR",
    build: (type, imdbId, season, episode) =>
      type === "movie"
        ? `https://framextv.cc/embed/movie/${imdbId}?server=archer&autoplay=1`
        : `https://framextv.cc/embed/tv/${imdbId}/${season ?? 1}/${episode ?? 1}?server=archer&autoplay=1`,
  },
];

// Preferences pointing at these ids predate the reorder above; they would
// resurrect the VidUP sandbox-wall as the default experience.
const DEPRECATED_DEFAULTS = new Set(["framextv", "framextv-archer"]);

export function sanitizePreferredServer(id: string | null | undefined): string | null {
  if (!id || DEPRECATED_DEFAULTS.has(id) || !SERVERS.some((s) => s.id === id)) {
    return null;
  }
  return id;
}

export function getServer(id: string): ServerDef {
  return SERVERS.find((s) => s.id === id) ?? SERVERS[0];
}

export function nextServerId(current: string): string {
  const idx = SERVERS.findIndex((s) => s.id === current);
  return SERVERS[(idx + 1) % SERVERS.length].id;
}
