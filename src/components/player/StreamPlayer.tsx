"use client";

import { useEffect, useRef, useState } from "react";
import { getServer, SERVERS } from "@/lib/servers";
import { useSettings, useHistory } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { parseSubtitles } from "@/lib/subParser";
import type { MediaType, SubtitleCue } from "@/types";
import { cn } from "@/lib/utils";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { ServerSwitcher } from "./ServerSwitcher";
import { SubtitleSettingsModal } from "./SubtitleSettingsModal";
import { AlertTriangle, Captions, ExternalLink, MonitorPlay, RefreshCw, Timer } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── StreamPlayer · multi-server iframe player w/ subtitle engine ────────────

interface Props {
  type: MediaType;
  imdbId: string;
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  poster?: string;
  runtimeMin?: number; // for progress estimation
}

type SubStatus = "idle" | "loading" | "loaded" | "none";

// NOTE: no `sandbox` attribute on player iframes — VidSrc-family providers
// detect sandboxed frames and refuse to play ("Please Disable Sandbox").
// We keep the frame locked down via `allow` permissions instead.

export function StreamPlayer({
  type,
  imdbId,
  title,
  season,
  episode,
  episodeTitle,
  poster,
  runtimeMin,
}: Props) {
  const t = useT();
  const {
    subLang,
    subOffset,
    subSize,
    subStyle,
    preferredServer,
    setPreferredServer,
    setSubLang,
  } = useSettings();
  const history = useHistory();

  const [serverId, setServerId] = useState<string>(() => preferredServer ?? SERVERS[0].id);
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  // failover bookkeeping (refs — only touched inside effects/handlers)
  const loadedRef = useRef(false);
  const triedRef = useRef<Set<string>>(new Set());
  const userPickedRef = useRef(false);

  // ── subtitle engine state ──
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [subStatus, setSubStatus] = useState<SubStatus>("idle");
  const [loadedLang, setLoadedLang] = useState<"ar" | "en" | null>(null);
  const [localCues, setLocalCues] = useState<SubtitleCue[] | null>(null);
  const localCuesRef = useRef<SubtitleCue[] | null>(null);

  // ── time tracking ──
  const [providerTime, setProviderTime] = useState<number | null>(null);
  const [providerSeen, setProviderSeen] = useState(false);
  const [clockTime, setClockTime] = useState(0);
  const [clockRunning, setClockRunning] = useState(false);

  const server = getServer(serverId);
  const src = server.build(type, imdbId, season, episode);

  const fullTitle =
    type === "series" && season && episode
      ? `${title} · ${t("season")} ${season}, ${t("episode")} ${episode}`
      : title;

  // reset load/time state (called from event handlers, not effects)
  const resetPlaybackState = () => {
    setLoading(true);
    setSlow(false);
    setOverlayDismissed(false);
    setProviderTime(null);
    setProviderSeen(false);
    setClockTime(0);
    setClockRunning(false);
  };

  // ── watchdog: 8s veil-cap → 20s auto-failover (per server, once) ──
  useEffect(() => {
    loadedRef.current = false;
    const veilT = setTimeout(() => {
      // never hold the video hostage — reveal whatever the provider rendered
      setLoading(false);
      if (!loadedRef.current) setSlow(true);
    }, 8000);
    const failT = setTimeout(() => {
      if (loadedRef.current || userPickedRef.current) return;
      triedRef.current.add(serverId);
      const next = SERVERS.find((s) => !triedRef.current.has(s.id));
      if (next) {
        toast({
          title: t("serverSlow"),
          description: `${server.name} ${server.tag ?? ""} → ${next.name} ${next.tag ?? ""}`,
        });
        setServerId(next.id);
        setPreferredServer(next.id);
        setFrameKey((k) => k + 1);
        setLoading(true);
        setSlow(false);
        setOverlayDismissed(false);
      } else {
        setSlow(true); // every server tried — leave manual switcher
      }
    }, 20000);
    return () => {
      clearTimeout(veilT);
      clearTimeout(failT);
    };
  }, [serverId, frameKey, server, t, setPreferredServer]);

  // ── provider postMessage time tracking (tolerant multi-shape listener) ──
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        const d = e.data;
        if (!d || typeof d !== "object") return;
        let time: unknown =
          d.currentTime ?? d.current_time ?? d.position ?? d.data?.currentTime ?? d.data?.time;
        if (typeof time === "string" && /^\d+(\.\d+)?$/.test(time)) time = parseFloat(time);
        if (typeof time === "number" && Number.isFinite(time) && time >= 0 && time < 86400) {
          setProviderSeen(true);
          setProviderTime(time);
        }
      } catch {
        /* ignore malformed */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // fallback internal clock (started manually if provider doesn't report time)
  useEffect(() => {
    if (providerSeen || !clockRunning) return;
    const started = Date.now() - clockTime * 1000;
    const iv = setInterval(() => {
      setClockTime((Date.now() - started) / 1000);
    }, 500);
    return () => clearInterval(iv);
  }, [clockRunning, providerSeen]);

  const effectiveTime = providerSeen ? (providerTime ?? 0) : clockTime;

  const startSync = () => {
    setClockTime(0);
    setClockRunning(true);
    toast({ title: t("play"), description: t("sync") + " 0.0s" });
  };

  // ── subtitle fetching (Arabic default → English fallback preference) ──
  // Server may respond { pending: true } while the AI translation job runs;
  // poll every 5 s (up to ~4 min) until cues are ready.
  const [subFetchNonce, setSubFetchNonce] = useState(0);
  useEffect(() => {
    if (subLang === "off") return;
    let cancelled = false;
    let pollT: ReturnType<typeof setTimeout> | null = null;
    const loadingT = setTimeout(() => !cancelled && setSubStatus("loading"), 0);
    (async () => {
      for (let attempt = 0; attempt < 48 && !cancelled; attempt++) {
        try {
          const qs = new URLSearchParams({ type, id: imdbId, lang: subLang === "ar" ? "ar" : "en" });
          if (type === "series" && season) qs.set("season", String(season));
          if (type === "series" && episode) qs.set("episode", String(episode));
          const res = await fetch(`/api/subtitles?${qs}`);
          const data = (await res.json()) as {
            cues?: SubtitleCue[];
            count?: number;
            pending?: boolean;
            progress?: number;
          };
          if (cancelled) return;
          if (data.pending) {
            setSubStatus("loading");
            await new Promise<void>((r) => {
              pollT = setTimeout(r, 5000);
            });
            continue;
          }
          const got = data.cues ?? [];
          if (got.length > 0) {
            if (!localCuesRef.current) setCues(got);
            setSubStatus("loaded");
            setLoadedLang(subLang);
            toast({
              title: subLang === "ar" ? t("subsLoaded") : t("subsLoadedEn"),
              description: `${got.length.toLocaleString()} cues · ${t("appName")}`,
            });
            // auto-start the subtitle clock shortly after load (providers
            // autoplay muted); the Sync button re-zeros it any time
            setTimeout(() => {
              if (cancelled) return;
              setClockTime(0);
              setClockRunning(true);
            }, 2500);
          } else {
            setSubStatus("none");
          }
          return;
        } catch {
          if (!cancelled) setSubStatus("none");
          return;
        }
      }
      if (!cancelled) setSubStatus("none");
    })();
    return () => {
      cancelled = true;
      clearTimeout(loadingT);
      if (pollT) clearTimeout(pollT);
    };
  }, [subLang, type, imdbId, season, episode, t, subFetchNonce]);

  const refetchSubs = () => setSubFetchNonce((n) => n + 1);

  const importFile = async (file: File) => {
      try {
        const text = await file.text();
        const parsed = parseSubtitles(text);
        if (parsed.length === 0) {
          setSubStatus("none");
          toast({ title: t("subsNone"), variant: "destructive" });
          return;
        }
        setLocalCues(parsed);
        localCuesRef.current = parsed;
        setCues(parsed);
        setSubStatus("loaded");
        setLoadedLang(parsed.some((c) => /[\u0600-\u06FF]/.test(c.text)) ? "ar" : "en");
        if (subLang === "off") setSubLang("ar");
        toast({ title: t("subsLoaded"), description: `${parsed.length.toLocaleString()} cues` });
      } catch {
        toast({ title: t("error"), variant: "destructive" });
      }
  };

  // ── watch history ──
  useEffect(() => {
    history.upsert({
      imdbId,
      type,
      title,
      poster,
      season,
      episode,
      episodeTitle,
      progressPct: 1,
    });
    
  }, [imdbId, type, season, episode]);

  // periodic progress while watching (approximate; provider time if available)
  useEffect(() => {
    const iv = setInterval(() => {
      const secs = providerSeen ? (providerTime ?? 0) : clockRunning ? clockTime : 0;
      if (secs <= 0) return;
      const denom = (type === "series" ? 45 : runtimeMin ?? 110) * 60;
      const pct = Math.min(97, Math.round((secs / denom) * 100));
      history.upsert({
        imdbId,
        type,
        title,
        poster,
        season,
        episode,
        episodeTitle,
        progressPct: Math.max(1, pct),
      });
    }, 30000);
    return () => clearInterval(iv);
    
  }, [imdbId, type, providerTime, providerSeen, clockRunning, clockTime, season, episode, runtimeMin]);

  const switchServer = (id: string) => {
    if (id === serverId) return;
    userPickedRef.current = true; // manual choice → disable auto-failover
    triedRef.current = new Set([id]);
    setServerId(id);
    setPreferredServer(id);
    setFrameKey((k) => k + 1);
    resetPlaybackState();
  };

  const refreshFrame = () => {
    setFrameKey((k) => k + 1);
    resetPlaybackState();
  };

  // last-resort escape hatch: provider pages always play in a top-level tab
  const openDirect = () => {
    window.open(src, "_blank", "noopener");
  };

  const cueCount = cues.length;

  return (
    <section className="w-full" aria-label={`${t("playerTitle")} ${fullTitle}`}>
      {/* ── Video frame ── */}
      <div className="relative aspect-video w-full overflow-hidden rounded-none border-y border-border/60 bg-black sm:rounded-2xl sm:border">
        <iframe
          key={`${serverId}-${frameKey}`}
          src={src}
          title={fullTitle}
          className="absolute inset-0 h-full w-full"
          referrerPolicy="origin"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          onLoad={() => {
            loadedRef.current = true;
            setLoading(false);
          }}
        />

        {/* loading veil */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-sm">
            <div className="relative">
              <MonitorPlay className="h-12 w-12 text-primary animate-pulse-glow" aria-hidden />
            </div>
            <p className="text-sm font-medium text-zinc-300">
              {t("serverLoading")} {server.name} {server.tag ? `· ${server.tag}` : ""}…
            </p>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full w-1/2 animate-[shimmer_1.4s_infinite] rounded-full bg-primary" />
            </div>
          </div>
        )}

        {/* slow / failover overlay (inside video, dismissible) */}
        {slow && !loading && !overlayDismissed && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center backdrop-blur-sm">
            <AlertTriangle className="h-10 w-10 text-amber-400" aria-hidden />
            <div className="space-y-1">
              <p className="text-base font-bold text-white">{t("serverSlow")}</p>
              <p className="max-w-sm text-xs text-zinc-400">{t("serverSlowDesc")}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  const idx = SERVERS.findIndex((s) => s.id === serverId);
                  switchServer(SERVERS[(idx + 1) % SERVERS.length].id);
                }}
                className="min-h-[40px] rounded-full bg-primary px-5 py-2 text-xs font-black text-black transition-transform active:scale-95"
              >
                {t("switchServer")} →
              </button>
              <button
                onClick={openDirect}
                className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/25 px-5 py-2 text-xs font-bold text-zinc-300 transition-colors hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                {t("openDirect")}
              </button>
              <button
                onClick={() => setOverlayDismissed(true)}
                className="min-h-[40px] rounded-full border border-white/25 px-5 py-2 text-xs font-bold text-zinc-300 transition-colors hover:text-white"
              >
                {t("back")}
              </button>
            </div>
          </div>
        )}

        {/* subtitle overlay */}
        <SubtitleOverlay
          cues={localCues ?? cues}
          currentTime={effectiveTime}
          offset={subOffset}
          sizePx={subSize}
          style={subStyle}
          visible={subLang !== "off" && subStatus === "loaded"}
        />
      </div>

      {/* ── Control deck ── */}
      <div className="mt-3 space-y-3 rounded-2xl border border-border/60 bg-card/50 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ServerSwitcher activeId={serverId} loading={loading} slow={slow} onSelect={switchServer} t={t} />

          <div className="flex items-center gap-2">
            {/* manual subtitle clock (only when provider time absent) */}
            {!providerSeen && subLang !== "off" && subStatus === "loaded" && (
              <button
                onClick={startSync}
                className={cn(
                  "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                  clockRunning
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-amber-400/50 bg-amber-400/10 text-amber-300 animate-pulse-glow"
                )}
                title={t("sync")}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden />
                {clockRunning ? t("sync") : "▶ " + t("sync")}
              </button>
            )}

            {/* subtitle status + settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              className={cn(
                "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                subStatus === "loaded" && subLang !== "off"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
              aria-haspopup="dialog"
            >
              <Captions className="h-4 w-4" aria-hidden />
              {t("subtitles")}
              {subLang !== "off" && (
                <span className="rounded bg-primary/20 px-1 font-mono text-[10px] uppercase">
                  {subLang}
                </span>
              )}
            </button>

            <button
              onClick={openDirect}
              className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
              title={t("openDirect")}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{t("openDirect")}</span>
            </button>

            <button
              onClick={refreshFrame}
              className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
              title={t("switchServer")}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {/* failover hint */}
        {(slow || subStatus === "none") && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {slow && (
              <button
                onClick={() => {
                  const idx = SERVERS.findIndex((s) => s.id === serverId);
                  switchServer(SERVERS[(idx + 1) % SERVERS.length].id);
                }}
                className="group flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-start text-xs text-amber-200 transition-colors hover:bg-amber-400/20"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong className="font-bold">{t("serverSlow")}</strong>{" "}
                  <span className="underline-offset-2 group-hover:underline">
                    {t("serverSlowDesc")}
                  </span>
                </span>
              </button>
            )}
            {subStatus === "none" && subLang !== "off" && (
              <p className="text-xs text-muted-foreground">
                {t("subsNone")} — {t("subsNoneHint")}
              </p>
            )}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground/70">{t("serverHint")}</p>
      </div>

      <SubtitleSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        status={subStatus}
        cueCount={cueCount}
        loadedLang={loadedLang}
        onImportFile={importFile}
        onRefetch={refetchSubs}
        t={t}
      />
    </section>
  );
}
