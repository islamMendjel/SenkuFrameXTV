"use client";

import { memo } from "react";
import type { SubtitleCue } from "@/types";
import { cueAt, isArabicText } from "@/lib/subParser";

// ─── SubtitleOverlay · zero-latency RTL-aware cue renderer ───────────────────

interface Props {
  cues: SubtitleCue[];
  currentTime: number;
  offset: number; // seconds, user calibration
  sizePx: number;
  style: "outline" | "boxed";
  visible: boolean;
}

function SubtitleOverlayBase({ cues, currentTime, offset, sizePx, style, visible }: Props) {
  if (!visible || cues.length === 0) return null;
  const cue = cueAt(cues, currentTime + offset);
  if (!cue) return null;

  const rtl = isArabicText(cue.text);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[6%] z-30 flex justify-center px-4 sm:px-10"
      aria-live="polite"
      aria-atomic="true"
      role="caption"
    >
      <p
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ar" : "en"}
        style={{ fontSize: `${sizePx}px` }}
        className={`subtitle-cue subtitle-outline max-w-[92%] whitespace-pre-line text-center font-semibold text-white sm:max-w-[80%] ${
          style === "boxed" ? "subtitle-boxed" : ""
        }`}
      >
        {cue.text}
      </p>
    </div>
  );
}

export const SubtitleOverlay = memo(SubtitleOverlayBase);
