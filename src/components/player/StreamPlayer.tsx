"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getServer, SERVERS } from "@/lib/servers";
import { useSettings, useHistory } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { parseSubtitles, decodeSubtitleBuffer, formatClock } from "@/lib/subParser";
import { usePlayerSync } from "@/hooks/usePlayerSync";
import type { MediaType, SubtitleCue } from "@/types";
import { cn } from "@/lib/utils";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { ServerSwitcher } from "./ServerSwitcher";
import { SubtitleSettingsModal } from "./SubtitleSettingsModal";
import { NextEpisodeCard, type NextEpisodeInfo } from "./NextEpisodeCard";
import {
  AlertTriangle,
  Captions,
  ExternalLink,
  Languages,
  MonitorPlay,
  Pause,
  Play,
  RefreshCw,
  Radio,
  Timer,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── StreamPlayer · multi-server player w/ Autopilot precision sync ──────────
//
// VidSrc-family providers post PLAYER_EVENT telemetry (currentTime / duration
// / play-state) up the relay chain to our window. usePlayerSync turns that
// into a live clock → perfectly-synced subtitles, an exact transport bar and
// the end-of-episode Autopilot card. Servers that don't report fall back to
// a one-tap manual sync clock.

interface Props {
  type: MediaType;
  imdbId: string;
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  poster?: string;
  runtimeMin?: number; // for progress estimation (manual mode)
  nextEpisode?: NextEpisodeInfo;
}

type SubStatus = "idle" | "loading" | "interim" | "loaded" | "none";

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
  nextEpisode,
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

  // ── Autopilot telemetry engine ──
  const frameToken = `${serverId}-${frameKey}`;
  const playerFrameRef = useRef<HTMLIFrameElement | null>(null);
  const sync = usePlayerSync(frameToken, playerFrameRef);

  // ── subtitle engine state ──
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [subStatus, setSubStatus] = useState<SubStatus>("idle");
  const [subProgress, setSubProgress] = useState<number | null>(null);
  const [loadedLang, setLoadedLang] = useState<"ar" | "en" | null>(null);
  const [localCues, setLocalCues] = useState<SubtitleCue[] | null>(null);
  const localCuesRef = useRef<SubtitleCue[] | null>(null);

  // ── autopilot: derived visibility (no mirrored state → no setState in effect) ──
  const [autopilotDismissed, setAutopilotDismissed] = useState(false);
  const autopilotFinished =
    !!nextEpisode &&
    (sync.status === "completed" ||
      (sync.duration > 120 &&
        sync.status === "playing" &&
        sync.currentTime >= sync.duration * 0.965));
  const showAutopilot = autopilotFinished && !autopilotDismissed;

  const server = getServer(serverId);
  const src = server.build(type, imdbId, season, episode);

  const fullTitle =
    type === "series" && season && episode
      ? `${title} · ${t("season")} ${season}, ${t("episode")} ${episode}`
      : title;

  const resetPlaybackState = () => {
    setLoading(true);
    setSlow(false);
    setOverlayDismissed(false);
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
        resetPlaybackState();
      } else {
        setSlow(true); // every server tried — leave manual switcher
      }
    }, 20000);
    return () => {
      clearTimeout(veilT);
      clearTimeout(failT);
    };
  }, [serverId, frameKey]);

  // ── subtitle fetching (Arabic default → English fallback preference) ──
  // Server may respond { pending: true } while the AI translation job runs;
  // poll every 5 s (up to ~4 min) until cues are ready.
  const [subFetchNonce, setSubFetchNonce] = useState(0);
  useEffect(() => {
    if (subLang === "off") return;
    let cancelled = false;
    let pollT: ReturnType<typeof setTimeout> | null = null;
    const loadingT = setTimeout(() => !cancelled && setSubStatus("loading"), 0);
    // toast only when real work happened (translation/polling or manual refetch);
    // instantly-cached tracks load silently — no notification noise per page view
    let sawWork = subFetchNonce > 0;
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
            interim?: boolean;
          };
          if (cancelled) return;
          if (data.pending) {
            sawWork = true;
            setSubProgress(typeof data.progress === "number" ? data.progress : null);
            // English interim track: captions NOW while Arabic AI cooks
            if (data.interim && Array.isArray(data.cues) && data.cues.length > 0 && !localCuesRef.current) {
              setCues(data.cues);
              setSubStatus("interim");
              setLoadedLang("en");
            } else {
              setSubStatus((s) => (s === "interim" ? s : "loading"));
            }
            await new Promise<void>((r) => {
              pollT = setTimeout(r, 5000);
            });
            continue;
          }
          const got = data.cues ?? [];
          if (got.length > 0) {
            if (!localCuesRef.current) setCues(got);
            setSubStatus("loaded");
            setSubProgress(null);
            setLoadedLang(subLang);
            if (sawWork) {
              toast({
                title: subLang === "ar" ? t("subsLoaded") : t("subsLoadedEn"),
                description: `${got.length.toLocaleString()} cues · ${t("appName")}`,
              });
            }
          } else {
            setSubStatus((s) => (s === "interim" ? "interim" : "none"));
          }
          return;
        } catch {
          if (!cancelled) setSubStatus((s) => (s === "interim" ? "interim" : "none"));
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
  }, [subLang, type, imdbId, season, episode, subFetchNonce]);

  const refetchSubs = () => setSubFetchNonce((n) => n + 1);

  const importFile = async (file: File) => {
    try {
      // charset-aware: CP1256 Arabic uploads decode correctly too
      const raw = decodeSubtitleBuffer(await file.arrayBuffer());
      const parsed = parseSubtitles(raw);
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

  // ── watch history: mark visit (keep prior progress), then exact telemetry ──
  const lastSaveRef = useRef(0);
  const lastPctRef = useRef(0);

  const saveProgress = useCallback(
    (pct: number) => {
      lastPctRef.current = pct;
      lastSaveRef.current = Date.now();
      useHistory.getState().upsert({
        imdbId,
        type,
        title,
        poster,
        season,
        episode,
        episodeTitle,
        progressPct: Math.max(1, Math.min(100, Math.round(pct))),
      });
    },
    [imdbId, type, title, poster, season, episode, episodeTitle]
  );

  useEffect(() => {
    // first visit marks 1%, re-visits keep their old progress
    const prior = useHistory.getState().get(imdbId);
    saveProgress(prior?.progressPct ?? 1);
  }, [imdbId, season, episode]);

  // progress pipeline: exact from provider telemetry, estimate in manual mode
  useEffect(() => {
    if (sync.status === "completed") {
      saveProgress(100);
      return;
    }
    if (sync.providerDriven && sync.duration > 0 && sync.currentTime > 0) {
      const pct = (sync.currentTime / sync.duration) * 100;
      const due = Date.now() - lastSaveRef.current > 15_000;
      const milestone = Math.floor(pct / 5) > Math.floor(lastPctRef.current / 5);
      if (due || milestone) saveProgress(pct);
    } else if (sync.manualMode && sync.currentTime > 0) {
      if (Date.now() - lastSaveRef.current > 30_000) {
        const denom = (type === "series" ? 45 : runtimeMin ?? 110) * 60;
        saveProgress(Math.min(97, (sync.currentTime / denom) * 100));
      }
    }
  }, [sync.currentTime, sync.duration, sync.status, sync.providerDriven, sync.manualMode, type, runtimeMin]);

  // persist 100% exactly once at completion
  const autopilotSavedRef = useRef(false);
  useEffect(() => {
    if (autopilotFinished && !autopilotSavedRef.current) {
      autopilotSavedRef.current = true;
      saveProgress(100);
    }
    if (!autopilotFinished) autopilotSavedRef.current = false;
  }, [autopilotFinished, saveProgress]);

  // ── Autopilot trigger bookkeeping is derived (see autopilotFinished above) ──

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

  const startManualSync = () => {
    sync.armManual();
    toast({ title: t("syncRunning"), description: t("startSyncHint") });
  };

  const cueCount = (localCues ?? cues).length;
  const showSubs =
    subLang !== "off" && (subStatus === "loaded" || subStatus === "interim");
  const translatingAr = subLang === "ar" && subStatus === "interim";
  const progressPct =
    sync.duration > 0 ? Math.min(100, (sync.currentTime / sync.duration) * 100) : 0;

  // sync-mode chip: precision (live) / estimated / manual
  const syncChip = !showSubs ? null : sync.providerDriven ? (
    <span
      className={cn(
        "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
        sync.estimated
          ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
          : "border-primary/50 bg-primary/10 text-primary"
      )}
      title={sync.estimated ? t("estimatedSync") : t("precisionSync")}
    >
      <Radio className={cn("h-3.5 w-3.5", !sync.estimated && "animate-pulse-glow")} aria-hidden />
      <span className="hidden sm:inline">
        {sync.estimated ? t("estimatedSync") : t("precisionSync")}
      </span>
    </span>
  ) : sync.manualMode ? (
    <span className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300">
      <Timer className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{t("manualSync")}</span>
    </span>
  ) : null;

  return (
    <section className="w-full" aria-label={`${t("playerTitle")} ${fullTitle}`}>
      {/* ── Video frame ── */}
      <div className="relative aspect-video w-full overflow-hidden rounded-none border-y border-border/60 bg-black sm:rounded-2xl sm:border">
        <iframe
          key={frameToken}
          src={src}
          title={fullTitle}
          ref={playerFrameRef}
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
            <MonitorPlay className="h-12 w-12 animate-pulse-glow text-primary" aria-hidden />
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

        {/* Binge Autopilot: end-of-episode countdown */}
        {showAutopilot && nextEpisode && (
          <NextEpisodeCard
            next={nextEpisode}
            poster={poster}
            onDone={() => setAutopilotDismissed(true)}
            t={t}
          />
        )}

        {/* subtitle overlay */}
        <SubtitleOverlay
          cues={localCues ?? cues}
          currentTime={sync.currentTime}
          offset={subOffset}
          sizePx={subSize}
          style={subStyle}
          visible={showSubs}
        />
      </div>

      {/* ── Control deck ── */}
      <div className="mt-3 space-y-3 rounded-2xl border border-border/60 bg-card/50 p-3 sm:p-4">
        {/* live transport (provider telemetry only) */}
        {sync.providerDriven && (
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-black/40 px-3 py-2">
            <button
              onClick={() => sync.sendCommand(sync.status === "playing" ? "pause" : "play")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25"
              aria-label={sync.status === "playing" ? t("pause") : t("play")}
              title={sync.status === "playing" ? t("pause") : t("play")}
            >
              {sync.status === "playing" ? (
                <Pause className="h-4 w-4 fill-primary" aria-hidden />
              ) : (
                <Play className="h-4 w-4 fill-primary" aria-hidden />
              )}
            </button>

            <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-zinc-300">
              {formatClock(sync.currentTime)}
              {sync.duration > 0 && (
                <span className="text-zinc-500"> / {formatClock(sync.duration)}</span>
              )}
            </span>

            {/* progress track (no seek — provider doesn't support it) */}
            <div
              className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPct)}
            >
              <div
                className="absolute inset-y-0 start-0 rounded-full bg-primary transition-[width] duration-300 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {sync.quality && (
              <span className="hidden shrink-0 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] font-black uppercase text-primary sm:inline">
                {sync.quality}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ServerSwitcher activeId={serverId} loading={loading} slow={slow} onSelect={switchServer} t={t} />

          <div className="flex items-center gap-2">
            {syncChip}

            {/* manual subtitle clock (servers without telemetry) */}
            {!sync.providerDriven && showSubs && (
              <button
                onClick={startManualSync}
                className={cn(
                  "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                  sync.manualMode
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-amber-400/50 bg-amber-400/10 text-amber-300 animate-pulse-glow"
                )}
                title={t("startSyncHint")}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden />
                {sync.manualMode ? t("syncRunning") : `▶ ${t("startSync")}`}
              </button>
            )}

            {/* live AI-translation progress (English interim → Arabic hot-swap) */}
            {translatingAr && (
              <span
                className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
                title={t("arTranslating")}
                role="status"
              >
                <Languages className="h-3.5 w-3.5 animate-pulse-glow" aria-hidden />
                {t("arTranslating")}
                {subProgress != null && (
                  <span className="font-mono tabular-nums">
                    {Math.min(99, Math.round(subProgress * 100))}%
                  </span>
                )}
              </span>
            )}

            {/* subtitle status + settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              className={cn(
                "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                showSubs
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

        {/* manual-sync hint (only for silent servers with subs loaded) */}
        {!sync.providerDriven && showSubs && !sync.manualMode && (
          <p className="text-[11px] leading-relaxed text-amber-300/80">{t("startSyncHint")}</p>
        )}

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
