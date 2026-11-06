"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { SubtitleCue } from "@/types";
import { cueAt, isArabicText } from "@/lib/subParser";
import { cn } from "@/lib/utils";

// ─── SubtitleOverlay · Frame-Lock cue renderer ───────────────────────────────
// Runs a requestAnimationFrame loop that pulls playback time straight from the
// sync engine's live clock — no React state hops, no 4Hz quantization. A cue
// switches on the exact frame it starts, so Arabic text lands in sync with the
// audio instead of trailing it. React re-renders only when the cue itself
// changes (a few times a minute), not per frame.

interface Props {
  cues: SubtitleCue[];
  /** live playback clock — called every animation frame */
  getTime: () => number;
  /** seconds of compensation (positive → cues appear earlier) */
  offset: number;
  sizePx: number;
  style: "outline" | "boxed";
  visible: boolean;
  /** fullscreen multiplier — bigger stage, bigger captions */
  scale?: number;
}

function SubtitleOverlayBase({
  cues,
  getTime,
  offset,
  sizePx,
  style,
  visible,
  scale = 1,
}: Props) {
  const [active, setActive] = useState<SubtitleCue | null>(null);

  // latest-value refs: the rAF loop reads props without re-subscribing
  const cuesRef = useRef(cues);
  const clockRef = useRef({ getTime, offset, visible });
  useEffect(() => {
    cuesRef.current = cues;
    clockRef.current = { getTime, offset, visible };
  }, [cues, getTime, offset, visible]);

  useEffect(() => {
    let raf = 0;
    let lastKey = "";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const { getTime: now, offset: off, visible: vis } = clockRef.current;
      if (!vis) {
        if (lastKey !== "") {
          lastKey = "";
          setActive(null);
        }
        return;
      }
      const cue = cueAt(cuesRef.current, now() + off);
      const key = cue ? `${cue.start}|${cue.end}|${cue.text}` : "";
      if (key !== lastKey) {
        lastKey = key;
        setActive(cue);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!visible || !active) return null;

  const rtl = isArabicText(active.text);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[6%] z-30 flex justify-center px-4 sm:px-10"
      aria-live="polite"
      aria-atomic="true"
      role="caption"
    >
      <p
        key={`${active.start}-${active.end}`}
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ar" : "en"}
        style={{ fontSize: `${Math.round(sizePx * scale)}px` }}
        className={cn(
          "subtitle-cue subtitle-outline max-w-[92%] whitespace-pre-line text-center font-semibold text-white sm:max-w-[80%]",
          style === "boxed" && "subtitle-boxed"
        )}
      >
        {active.text}
      </p>
    </div>
  );
}

export const SubtitleOverlay = memo(SubtitleOverlayBase);
