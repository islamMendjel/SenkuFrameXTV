import type { MediaType, ServerBuildOpts, ServerDef } from "@/types";

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

// ── Provider-native subtitle steering (official docs: vidsrc.sh/vidsrc/docs,
//    superembed.stream) ──────────────────────────────────────────────────────
//  ds_lang=ar → the provider's auto-selected default track prefers ARABIC.
//  With no Arabic source available the player starts with NO default track
//  instead of falling back to English — English never surfaces on its own.
//  sub_url    → our cached Arabic WebVTT, fetched by the viewer's browser and
//  auto-applied by the provider: our cues are rendered on the provider's own
//  video timeline (frame-exact against the audio, zero relay latency) and
//  they live INSIDE the video, so every fullscreen mode keeps them visible.
function withSubParams(base: string, opts?: ServerBuildOpts, autoplay = true): string {
  const q: string[] = ["ds_lang=ar"];
  if (autoplay) q.push("autoplay=1");
  if (opts?.subUrl) {
    q.push(`sub_url=${encodeURIComponent(opts.subUrl)}`);
    q.push(`sub_label=${encodeURIComponent("العربية")}`);
    q.push("sub_lang=ar");
  }
  return `${base}?${q.join("&")}`;
}

export const SERVERS: ServerDef[] = [
  {
    // vidsrc.sh is the actual relay/player host (the vidsrc.to shell just
    // iframes it + injects an extra ad script). Direct embedding keeps the
    // postMessage relay complete — PLAYER_EVENT telemetry (currentTime,
    // duration, play/pause) bubbles to our window for precision-sync
    // subtitles, exact progress and Autopilot.
    id: "vidsrc-to",
    name: "VidSrc",
    tag: "Alpha",
    quality: "1080p",
    nativeSubs: true,
    build: (type, imdbId, season, episode, opts) =>
      type === "movie"
        ? withSubParams(`https://vidsrc.sh/embed/movie/${imdbId}`, opts)
        : withSubParams(
            `https://vidsrc.sh/embed/tv/${imdbId}/${season ?? 1}-${episode ?? 1}`,
            opts
          ),
  },
  {
    id: "vidsrc-icu",
    name: "VidSrc",
    tag: "Beta",
    quality: "1080p",
    nativeSubs: true,
    build: (type, imdbId, season, episode, opts) =>
      type === "movie"
        ? withSubParams(`https://vidsrc.icu/embed/movie/${imdbId}`, opts)
        : withSubParams(
            `https://vidsrc.icu/embed/tv/${imdbId}/${season ?? 1}/${episode ?? 1}`,
            opts
          ),
  },
  {
    id: "multiembed",
    name: "SuperEmbed",
    tag: "Multi",
    quality: "Multi-Qual",
    nativeSubs: true,
    build: (type, imdbId, season, episode, opts) => {
      const base =
        type === "movie"
          ? `https://multiembed.mov/?video_id=${imdbId}`
          : `https://multiembed.mov/?video_id=${imdbId}&s=${season ?? 1}&e=${episode ?? 1}`;
      // SuperEmbed: "&sub_url and &sub_label — your subtitles appear first
      // in list and autoplay" (no ds_lang support → nothing else injected).
      if (opts?.subUrl) {
        return `${base}&sub_url=${encodeURIComponent(opts.subUrl)}&sub_label=${encodeURIComponent("العربية")}`;
      }
      return base;
    },
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
