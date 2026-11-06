import type { SubtitleCue } from "@/types";

// ─── Senku-frameXTV · Subtitle engine · decoding + SRT/VTT parsing ───────────

function toSeconds(stamp: string): number {
  // supports: HH:MM:SS,mmm · MM:SS.mmm · HH:MM:SS.mmm
  const clean = stamp.trim().replace(",", ".");
  const parts = clean.split(":").map((p) => parseFloat(p));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseFloat(clean) || 0;
}

/**
 * Decode raw subtitle bytes with the right charset.
 * Arabic SRTs in the wild are UTF-8, UTF-16 (BOM), Windows-1256 or ISO-8859-6 —
 * decoding everything as UTF-8 turns CP1256 into mojibake (U+FFFD soup).
 */
export function decodeSubtitleBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length === 0) return "";

  // BOM sniffing
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  // strict UTF-8 first — real UTF-8 (incl. pure ASCII) always decodes
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    /* not UTF-8 → legacy 8-bit codepage */
  }

  const arabicRatio = (s: string): number => {
    const ar = s.match(/[\u0600-\u06FF]/g)?.length ?? 0;
    return ar / Math.max(1, s.length);
  };

  // Arabic legacy codepages (windows-1256 is by far the most common)
  for (const enc of ["windows-1256", "iso-8859-6"]) {
    try {
      const s = new TextDecoder(enc).decode(bytes);
      if (arabicRatio(s) > 0.01) return s;
    } catch {
      /* label unsupported in this runtime → next */
    }
  }

  // last resort: latin-1 keeps every byte (subtitle text, just maybe wrong script)
  return new TextDecoder("windows-1252").decode(bytes);
}

/** Detect & repair CP1256-mojibake already mis-decoded as Latin-1 garbage. */
export function repairEncoding(raw: string): string {
  if (/[\u0600-\u06FF]/.test(raw)) return raw; // already contains Arabic → fine
  // Heuristic: latin-1 gibberish typical of CP1256 Arabic (e.g. "ÊÑÌãÉ")
  const suspicious = raw.match(/[\xC0-\xFF\u0100-\u024F]/g);
  if (!suspicious || suspicious.length < raw.length * 0.02) return raw;
  try {
    const bytes = new Uint8Array(
      Array.from(raw, (ch) => {
        const c = ch.charCodeAt(0);
        return c <= 0xff ? c : 0x3f; // clamp into one byte
      })
    );
    const fixed = new TextDecoder("windows-1256").decode(bytes);
    if (/[\u0600-\u06FF]/.test(fixed)) return fixed;
  } catch {
    /* decode failure → keep raw */
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
      // strip VTT inline styles, HTML tags & ASS override blocks {\...}
      .replace(/<\/?[^>]+>/g, "")
      .replace(/\{\\[^}]*\}/g, "")
      // drop zero-width / BOM noise
      .replace(/[\u200B-\u200F\uFEFF]/g, "")
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
    hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid];
    if (t < c.start) hi = mid - 1;
    else if (t > c.end) lo = mid + 1;
    else return c;
  }
  return null;
}

export function formatOffset(ms: number): string {
  const v = ms / 1000;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}s`;
}

/** mm:ss / h:mm:ss clock display. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Detect if text is predominantly Arabic → RTL rendering. */
export function isArabicText(text: string): boolean {
  const arabic = text.match(/[\u0600-\u06FF]/g)?.length ?? 0;
  return arabic > 0;
}
