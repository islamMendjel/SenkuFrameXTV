import type { SubtitleCue } from "@/types";

// ─── Global subtitle calibration (Frame-Lock · serve-time) ───────────────────
// The cue tracks we fetch are mastered against a different release than the
// streams providers actually play — captions structurally trail the audio by
// ~1s (user-measured). Shifting at SERVE time fixes every surface at once:
// the provider-native sub_url VTT and the 60fps overlay both consume these
// cues, the cache stays raw, and per-episode [ / ] nudges stack on top.
export const SUB_CALIBRATION_S = 1.0;

/** Shift cue timestamps earlier by `shift` seconds (drop cues that expire). */
export function shiftCues(cues: SubtitleCue[], shift = SUB_CALIBRATION_S): SubtitleCue[] {
  if (shift <= 0) return cues;
  return cues
    .map((c) => ({ ...c, start: c.start - shift, end: c.end - shift }))
    .filter((c) => c.end > 0.15)
    .map((c) => ({ ...c, start: Math.max(0, c.start) }));
}
