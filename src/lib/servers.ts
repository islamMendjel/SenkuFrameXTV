import type { MediaType, ServerDef } from "@/types";

// ─── Senku-frameXTV · Multi-server fallback registry ────────────────────────
// All providers are keyed on IMDb IDs (tt…). frameXTV is the flagship per
// branding; VidSrc / SuperEmbed / 2Embed act as automatic fallbacks.

export const SERVERS: ServerDef[] = [
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
];

export function getServer(id: string): ServerDef {
  return SERVERS.find((s) => s.id === id) ?? SERVERS[0];
}

export function nextServerId(current: string): string {
  const idx = SERVERS.findIndex((s) => s.id === current);
  return SERVERS[(idx + 1) % SERVERS.length].id;
}
