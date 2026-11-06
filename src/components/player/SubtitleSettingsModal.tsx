"use client";

import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/lib/store";
import { formatOffset } from "@/lib/subParser";
import { Languages, Minus, Plus, RotateCcw, Upload, Type } from "lucide-react";
import type { DictKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ─── SubtitleSettingsModal · language / sync / size / style / import ─────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  status: "idle" | "loading" | "loaded" | "none";
  cueCount: number;
  loadedLang: "ar" | "en" | null;
  onImportFile: (file: File) => void;
  onRefetch: () => void;
  /** effective offset for THIS episode (episode override or global default) */
  offset: number;
  /** true when an episode-level override exists */
  offsetScoped: boolean;
  /** built-in lead that pre-empts provider stream latency */
  lead: number;
  onNudge: (d: number) => void;
  onReset: () => void;
  onSaveDefault: () => void;
  t: (k: DictKey) => string;
}

export function SubtitleSettingsModal({
  open,
  onOpenChange,
  status,
  cueCount,
  loadedLang,
  onImportFile,
  onRefetch,
  offset,
  offsetScoped,
  lead,
  onNudge,
  onReset,
  onSaveDefault,
  t,
}: Props) {
  const { subLang, setSubLang, subSize, setSubSize, subStyle, setSubStyle } =
    useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const statusLine =
    status === "loading"
      ? t("subsLoading")
      : status === "loaded"
        ? loadedLang === "ar"
          ? `${t("subsLoaded")} · ${cueCount.toLocaleString()}`
          : `${t("subsLoadedEn")} · ${cueCount.toLocaleString()}`
        : status === "none"
          ? t("subsNone")
          : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto border-border/80 bg-card/95 backdrop-blur-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Type className="h-5 w-5 text-primary" aria-hidden />
            {t("subtitleSettings")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pb-2">
          {/* Language */}
          <section aria-label={t("subLang")}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Languages className="h-4 w-4 text-primary" aria-hidden />
              {t("subLang")}
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-1">
              {(
                [
                  ["ar", t("subArabic")],
                  ["en", t("subEnglish")],
                  ["off", t("subOff")],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSubLang(val)}
                  aria-pressed={subLang === val}
                  className={cn(
                    "min-h-[38px] rounded-lg px-2 py-1.5 text-sm font-bold transition-all",
                    subLang === val
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {statusLine || t("embeddedCaptions")}
              {status === "none" && (
                <button onClick={onRefetch} className="ms-1 font-semibold text-primary hover:underline">
                  {t("retry")}
                </button>
              )}
            </p>
          </section>

          {/* Sync offset — fine ±0.1s calibration, saved per episode */}
          <section aria-label={t("sync")}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{t("sync")}</span>
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                <span
                  className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary/80"
                  title={t("autoLeadHint")}
                >
                  {t("autoLead")} +{lead.toFixed(1)}s
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 font-mono text-xs",
                    offset === 0
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/15 text-primary"
                  )}
                >
                  {formatOffset(offset * 1000)}
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    offsetScoped
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {offsetScoped ? t("syncScopeEpisode") : t("syncScopeGlobal")}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] flex-1 px-1 font-mono text-xs"
                onClick={() => onNudge(-0.5)}
                aria-label="-0.5s"
              >
                <Minus className="h-4 w-4" aria-hidden />0.5
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] px-2 font-mono text-xs"
                onClick={() => onNudge(-0.1)}
                aria-label="-0.1s"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />0.1
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] px-3"
                onClick={onReset}
                aria-label={t("reset")}
                title={t("reset")}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] px-2 font-mono text-xs"
                onClick={() => onNudge(0.1)}
                aria-label="+0.1s"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />0.1
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] flex-1 px-1 font-mono text-xs"
                onClick={() => onNudge(0.5)}
                aria-label="+0.5s"
              >
                <Plus className="h-4 w-4" aria-hidden />0.5
              </Button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{t("subsEarly")}</span>
              <span>{t("subsLate")}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("fineSyncHint")}
            </p>
            {offsetScoped && (
              <button
                onClick={onSaveDefault}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                {t("saveAsDefault")}
              </button>
            )}
          </section>

          {/* Font size */}
          <section aria-label={t("subSize")}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{t("subSize")}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {subSize}px
              </span>
            </div>
            <Slider
              value={[subSize]}
              min={16}
              max={52}
              step={2}
              onValueChange={([v]) => setSubSize(v)}
              aria-label={t("subSize")}
            />
            {/* live preview */}
            <div className="mt-3 flex h-14 items-center justify-center rounded-xl bg-zinc-950/90">
              <span
                dir={subLang === "ar" ? "rtl" : "ltr"}
                style={{ fontSize: `${Math.min(subSize, 24)}px` }}
                className="subtitle-cue subtitle-outline px-1 font-semibold text-white"
              >
                {subLang === "ar" ? "هل أنت هنا لتقتلني؟" : "Are you here to kill me?"}
              </span>
            </div>
          </section>

          {/* Style + import */}
          <section className="flex items-center justify-between gap-3">
            <div className="grid flex-1 grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1">
              {(["outline", "boxed"] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setSubStyle(val)}
                  aria-pressed={subStyle === val}
                  className={cn(
                    "min-h-[34px] rounded-lg px-2 py-1 text-xs font-bold transition-all",
                    subStyle === val
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {val === "outline" ? t("styleOutline") : t("styleBoxed")}
                </button>
              ))}
            </div>
            <Button variant="secondary" className="min-h-[38px] text-xs" onClick={() => fileRef.current?.click()}>
              <Upload className="me-1.5 h-4 w-4" aria-hidden />
              {t("loadFile")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".srt,.vtt,text/vtt,application/x-subrip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
