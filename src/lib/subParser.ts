import type { SubtitleCue } from "@/types";

// ─── Senku-frameXTV · Subtitle engine · SRT/VTT parsing + encoding repair ───

function toSeconds(stamp: string): number {
  // supports: HH:MM:SS,mmm · MM:SS.mmm · HH:MM:SS.mmm
  const clean = stamp.trim().replace(",", ".");
  const parts = clean.split(":").map((p) => parseFloat(p));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseFloat(clean) || 0;
}

/** Detect & repair CP1256-mojibake (Arabic read as Latin-1 garbage). */
export function repairEncoding(raw: string): string {
  if (/[\u0600-\u06FF]/.test(raw)) return raw; // already contains Arabic → fine
  // Heuristic: latin-1 gibberish typical of CP1256 Arabic (e.g. "ÊÑÌãÉ")
  const suspicious = raw.match(/[\xC0-\xFF\u0100-\u024F]/g);
  if (!suspicious || suspicious.length < raw.length * 0.02) return raw;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iconv = require("iconv-lite");
    const bytes = Buffer.from(raw, "latin1");
    const fixed = iconv.decode(bytes, "cp1256");
    if (/[\u0600-\u06FF]/.test(fixed)) return fixed;
  } catch {
    /* iconv unavailable → keep raw */
  }
  return raw;
}

/** Parse SRT or WebVTT into normalized cues. */
export function parseSubtitles(raw: string): SubtitleCue[] {
  const text = repairEncoding(raw.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, ""));
  const isVTT = /^WEBVTT/i.test(text);
  const body = isVTT ? text.replace(/^WEBVTT[^\n]*\n/, "") : text;

  const cues: SubtitleCue[] = [];
  const blocks = body.split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;

    // locate the timing line (may be first line or after an index)
    let timingIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      if (lines[i].includes("-->")) {
        timingIdx = i;
        break;
      }
    }
    if (timingIdx === -1) continue;

    const timing = lines[timingIdx];
    const match = timing.match(
      /(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}|\d+\.?\d*)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}|\d+\.?\d*)/
    );
    if (!match) continue;

    const start = toSeconds(match[1]);
    const end = toSeconds(match[2]);
    const content = lines
      .slice(timingIdx + 1)
      .join("\n")
      // strip VTT inline styles & speaker tags
      .replace(/<\/?[^>]+>/g, "")
      .trim();

    if (!content || end <= start) continue;
    cues.push({ start, end, text: content });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/** Pick the cue active at t (offset in seconds). */
export function cueAt(cues: SubtitleCue[], t: number): SubtitleCue | null {
  if (cues.length === 0) return null;
  // binary search nearest
  let lo = 0,
    hi = cues.length - 1,
    ans: SubtitleCue | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid];
    if (t < c.start) hi = mid - 1;
    else if (t > c.end) lo = mid + 1;
    else return c;
  }
  return ans;
}

export function formatOffset(ms: number): string {
  const v = ms / 1000;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}s`;
}

/** Detect if text is predominantly Arabic → RTL rendering. */
export function isArabicText(text: string): boolean {
  const arabic = text.match(/[\u0600-\u06FF]/g)?.length ?? 0;
  return arabic > 0;
}
