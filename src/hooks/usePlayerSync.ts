"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

// ─── Senku Autopilot · player telemetry engine ────────────────────────────────
// Reverse-engineered VidSrc player protocol (player.js → relayed to top window):
//
//   IN  (player → us, via every relay level, postMessage '*'):
//     { type: 'PLAYER_EVENT', data: {
//         player_info:   { imdb, tmdb, mediaType, season, episode, title, poster },
//         player_status: 'playing' | 'paused' | 'seeked' | 'completed',
//         player_progress: 12.4,          // video.currentTime (s, 0.1 precision)
//         player_duration: 1260,          // video.duration (s)
//         quality: '1080p', availableQualities: [...]
//     }}
//     Pings arrive on play / pause / seek / ended and every ~5s while playing.
//
//   OUT (us → player, relayed down):
//     { player: true, action: 'play' | 'pause' | 'mute' | 'unmute' | 'rate', value? }
//
// Tolerant fallbacks are kept for providers that speak other shapes
// (vidlink/multiembed variants: {currentTime} / {data:{time}} …), plus a
// manual virtual clock for servers that report nothing at all.

export type PlayerSyncStatus = "idle" | "playing" | "paused" | "seeked" | "completed";

export interface PlayerSyncState {
  /** true once the provider has reported real telemetry this session */
  providerDriven: boolean;
  status: PlayerSyncStatus;
  /** best-effort current video time (interpolated between pings) */
  currentTime: number;
  duration: number;
  quality: string | null;
  /** provider stopped pinging while playing → currentTime is extrapolated */
  estimated: boolean;
  /** manual virtual clock armed by the user (non-reporting servers) */
  manualMode: boolean;
}

const PING_STALE_MS = 15_000; // playing pings arrive every ~5s
const TICK_MS = 250;

interface Anchor {
  t: number; // video seconds at wall-clock `wall`
  wall: number;
}

function extractTime(d: unknown): number | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  // vidsrc family: { type:'PLAYER_EVENT', data:{ player_progress } }
  const data = o.data as Record<string, unknown> | undefined;
  if (o.type === "PLAYER_EVENT" && data) {
    const p = data.player_progress;
    if (typeof p === "number" && Number.isFinite(p) && p >= 0) return p;
  }
  // generic shapes
  let t = o.currentTime ?? o.current_time ?? o.position ?? data?.currentTime ?? data?.time;
  if (typeof t === "string" && /^\d+(\.\d+)?$/.test(t)) t = parseFloat(t);
  if (typeof t === "number" && Number.isFinite(t) && t >= 0 && t < 86400) return t;
  return null;
}

function extractStatus(d: unknown): PlayerSyncStatus | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const data = o.data as Record<string, unknown> | undefined;
  const s = data?.player_status ?? o.player_status;
  if (s === "playing" || s === "paused" || s === "seeked" || s === "completed") return s;
  return null;
}

export function usePlayerSync(
  resetKey: string | number,
  /** attach to the provider iframe — commands post through this frame */
  frameRef: RefObject<HTMLIFrameElement | null>
) {
  const [state, setState] = useState<PlayerSyncState>({
    providerDriven: false,
    status: "idle",
    currentTime: 0,
    duration: 0,
    quality: null,
    estimated: false,
    manualMode: false,
  });

  // refs (message listener + ticker read these without re-subscribing)
  const anchorRef = useRef<Anchor>({ t: 0, wall: Date.now() });
  const statusRef = useRef<PlayerSyncStatus>("idle");
  const providerRef = useRef(false);
  const lastPingRef = useRef(0);
  const manualRef = useRef(false);
  const manualStartRef = useRef<number | null>(null);
  // ── reset when the provider iframe is swapped ──
  useEffect(() => {
    anchorRef.current = { t: 0, wall: Date.now() };
    statusRef.current = "idle";
    providerRef.current = false;
    lastPingRef.current = 0;
    manualRef.current = false;
    manualStartRef.current = null;
    setState((s) => ({
      ...s,
      providerDriven: false,
      status: "idle",
      currentTime: 0,
      duration: 0,
      quality: null,
      estimated: false,
      manualMode: false,
    }));
  }, [resetKey]);

  // ── telemetry listener ──
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        const d = e.data;
        if (!d || typeof d !== "object") return;
        const time = extractTime(d);
        if (time === null) return;

        const status = extractStatus(d) ?? statusRef.current;
        const data = (d as Record<string, unknown>).data as Record<string, unknown> | undefined;
        const dur = typeof data?.player_duration === "number" ? data.player_duration : undefined;
        const q = typeof data?.quality === "string" ? data.quality : undefined;

        // a real telemetry frame: anchor, mark provider-driven, kill manual clock
        providerRef.current = true;
        manualRef.current = false;
        manualStartRef.current = null;
        statusRef.current = status;
        lastPingRef.current = Date.now();
        anchorRef.current = { t: time, wall: Date.now() };

        setState((s) => ({
          ...s,
          providerDriven: true,
          status,
          currentTime: time,
          duration: dur && dur > 0 ? dur : s.duration,
          quality: q ?? s.quality,
          estimated: false,
          manualMode: false,
        }));
      } catch {
        /* ignore malformed frames */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // ── interpolation ticker (4Hz — smooth cues, cheap) ──
  useEffect(() => {
    const tick = () => {
      const now = Date.now();

      if (manualRef.current) {
        const started = manualStartRef.current;
        if (started != null) {
          const t = Math.max(0, (now - started) / 1000);
          setState((s) => (s.manualMode ? { ...s, currentTime: t } : s));
        }
        return;
      }

      if (!providerRef.current) return;
      const a = anchorRef.current;
      const playing = statusRef.current === "playing";
      const t = playing ? a.t + (now - a.wall) / 1000 : a.t;
      const estimated = playing && now - lastPingRef.current > PING_STALE_MS;

      setState((s) =>
        Math.abs(s.currentTime - t) < 0.05 && s.estimated === estimated
          ? s
          : { ...s, currentTime: t, estimated }
      );
    };
    const iv = setInterval(tick, TICK_MS);
    return () => clearInterval(iv);
  }, []);

  // ── manual clock (servers that never report) ──
  const armManual = useCallback(() => {
    providerRef.current = false;
    manualRef.current = true;
    manualStartRef.current = Date.now();
    statusRef.current = "playing";
    setState((s) => ({
      ...s,
      manualMode: true,
      providerDriven: false,
      status: "playing",
      currentTime: 0,
      estimated: false,
    }));
  }, []);

  const stopManual = useCallback(() => {
    manualRef.current = false;
    manualStartRef.current = null;
    statusRef.current = "idle";
    setState((s) => ({ ...s, manualMode: false, status: "idle" }));
  }, []);

  // ── transport commands (relayed down to the vidsrc-family player) ──
  const sendCommand = useCallback(
    (action: "play" | "pause" | "mute" | "unmute") => {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage({ player: true, action }, "*");
        // optimistic local flip for play/pause
        if (action === "play" || action === "pause") {
          const st: PlayerSyncStatus = action === "play" ? "playing" : "paused";
          statusRef.current = st;
          anchorRef.current = { t: anchorRef.current.t, wall: Date.now() };
          setState((s) => (s.providerDriven ? { ...s, status: st } : s));
        }
      } catch {
        /* provider not command-aware — ignore */
      }
    },
    []
  );

  return { ...state, armManual, stopManual, sendCommand };
}
