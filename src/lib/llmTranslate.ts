import "server-only";
import ZAI from "z-ai-web-dev-sdk";
import type { SubtitleCue } from "@/types";

// ─── AI subtitle translator · synced English srt → natural Arabic ────────────
// Uses the z-ai SDK (backend only). Cues are translated in numbered batches
// so timing stays untouched and alignment is guaranteed line-for-line.

const BATCH_SIZE = 70;
const MAX_CONCURRENCY = 2;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildPrompt(lines: string[], targetLang: string): string {
  return [
    `Translate each numbered subtitle line below into natural ${targetLang}.`,
    ``,
    `Rules:`,
    `- Keep the exact same numbering, one translated line per input line.`,
    `- These are dialogue subtitles: translate meaning, keep it short and natural for reading.`,
    `- Keep interjections, honorifics and tone appropriate for the show.`,
    `- Do NOT merge, split, skip, reorder or add lines.`,
    `- If a line is already in ${targetLang}, output it unchanged.`,
    `- Output ONLY the numbered lines, nothing else. No preamble, no notes.`,
    ``,
    ...lines.map((l, i) => `${i + 1}. ${l.replace(/\n/g, " ")}`),
  ].join("\n");
}

function parseNumbered(
  reply: string,
  expected: number
): string[] | null {
  const map = new Map<number, string>();
  for (const raw of reply.split("\n")) {
    const m = raw.match(/^\s*(\d{1,4})[.)]\s?(.*)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= expected && !map.has(n)) map.set(n, m[2].trim());
    }
  }
  if (map.size < Math.ceil(expected * 0.9)) return null; // too many missing
  const out: string[] = [];
  for (let i = 1; i <= expected; i++) {
    out.push(map.get(i) ?? ""); // rare gaps → empty (overlay skips empties)
  }
  return out;
}

export interface TranslateProgress {
  done: number;
  total: number;
}

/**
 * Translate dialogue cue texts (already extracted from a synced srt).
 * Returns cues with `text` replaced by the translated language.
 */
export async function translateCues(
  cues: SubtitleCue[],
  targetLang: "Arabic (Modern Standard, natural spoken style)" | "English",
  onProgress?: (p: TranslateProgress) => void
): Promise<SubtitleCue[]> {
  const zai = await ZAI.create();
  const texts = cues.map((c) => c.text);
  const batches = chunk(texts, BATCH_SIZE);
  const results: string[][] = new Array(batches.length);

  let done = 0;
  let cursor = 0;

  async function worker(wid: number) {
    while (cursor < batches.length) {
      const bi = cursor++;
      const batch = batches[bi];
      let attempt = 0;
      let parsed: string[] | null = null;
      while (attempt < 3 && !parsed) {
        attempt++;
        try {
          const completion = await zai.chat.completions.create({
            messages: [
              {
                role: "assistant",
                content:
                  "You are a professional subtitle translator for streaming services. You translate dialogue lines accurately, briefly and naturally, always preserving line numbering exactly.",
              },
              { role: "user", content: buildPrompt(batch, targetLang) },
            ],
            thinking: { type: "disabled" },
          });
          const reply = completion.choices[0]?.message?.content ?? "";
          parsed = parseNumbered(reply, batch.length);
          if (!parsed) {
            // one retry hint: ask to fix missing numbering
            const fix = await zai.chat.completions.create({
              messages: [
                { role: "user", content: buildPrompt(batch, targetLang) },
                { role: "assistant", content: reply.slice(0, 4000) },
                {
                  role: "user",
                  content: `Your reply was missing or malformed for some numbered lines. Re-output ALL ${batch.length} numbered lines in order, numbering first, translation only.`,
                },
              ],
              thinking: { type: "disabled" },
            });
            parsed = parseNumbered(fix.choices[0]?.message?.content ?? "", batch.length);
          }
        } catch {
          /* retry */
        }
        if (!parsed && attempt < 3) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
      results[bi] = parsed ?? batch; // final fallback: keep original text
      done++;
      onProgress?.({ done, total: batches.length });
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, batches.length) }, (_, i) =>
    worker(i)
  );
  await Promise.all(workers);

  const flat = results.flat();
  return cues.map((c, i) => ({ ...c, text: flat[i] || c.text }));
}
