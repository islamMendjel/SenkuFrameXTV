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
  t,
}: Props) {
  const { subLang, setSubLang, subSize, setSubSize, subStyle, setSubStyle, subOffset, nudgeSubOffset, setSubOffset } =
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

          {/* Sync offset */}
          <section aria-label={t("sync")}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{t("sync")}</span>
              <span
                className={cn(
                  "rounded-md bg-muted px-2 py-0.5 font-mono text-xs",
                  subOffset === 0 ? "text-muted-foreground" : "text-primary"
                )}
              >
                {formatOffset(subOffset * 1000)}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] flex-1 font-mono"
                onClick={() => nudgeSubOffset(-0.5)}
                aria-label="-0.5s"
              >
                <Minus className="h-4 w-4" aria-hidden /> 0.5s
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] px-3"
                onClick={() => setSubOffset(0)}
                aria-label={t("reset")}
                title={t("reset")}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[38px] flex-1 font-mono"
                onClick={() => nudgeSubOffset(0.5)}
                aria-label="+0.5s"
              >
                <Plus className="h-4 w-4" aria-hidden /> 0.5s
              </Button>
            </div>
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
              ariaLabel={t("subSize")}
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
