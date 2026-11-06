import "server-only";
import ZAI from "z-ai-web-dev-sdk";
import type { SubtitleCue } from "@/types";

// ─── AI subtitle translator · synced English srt → natural Arabic ────────────
// Uses the z-ai SDK (backend only). Cues are translated in numbered batches
// so timing stays untouched and alignment is guaranteed line-for-line.
//
// v2 — "perfect" pipeline:
//   1. main pass      → numbered batches, split-retry on parse failure
//   2. REPAIR pass    → any cue that is empty OR still carries un-whitelisted
//                       Latin words is re-translated in strict micro-batches
//                       (2 rounds max). This is what kills leftovers like
//                       "gentleman", "making fun of Sheldon" or lines the LLM
//                       silently dropped.
//   3. only if repair cannot produce target-script text do we keep the source.

const BATCH_SIZE = 70;
const MAX_CONCURRENCY = 3;
const REPAIR_ROUNDS = 3;

// Universal abbreviations/brands that stay Latin in Arabic subs by convention.
const LATIN_KEEP = new Set([
  "nasa","dvr","dvd","usb","hdmi","wifi","wi-fi","gps","dna","ok","okay","pc",
  "app","apps","ip","id","cpu","gpu","xbox","vr","ar","tv","uhd","hdr","4k",
  "led","lcd","sim","pin","sms","mms","pdf","jpg","gif","mp3","mp4","wifi",
  "fbi","cia","mi6","swat","er","icu","mri","x-ray","3d","2d","imax","hd",
  "ufo","uk","usa","ny","la","vegas","e.t","et","dr","mr","mrs","ms","st",
]);

const WORD_RE = /[A-Za-z][A-Za-z'’.-]{1,}/g;

// Universal interjections that legitimately stay in dialogue.
const INTERJECTIONS = new Set([
  "hmm","hmmm","hm","huh","wow","yeah","yes","nope","ugh","oof","psst","shh",
  "shhh","ah","ahh","ahhh","oh","ohh","ohhh","mmm","mm","hmm-mm","whoa","oops",
  "tsk","eh","duh","gosh","geez","yikes","bravo","ouch","yay","boo","ta-da",
]);

/** Latin word runs that must be translated (whitelist-aware). */
function latinStragglers(text: string): string[] {
  const runs = text.match(WORD_RE) ?? [];
  return runs.filter((w) => {
    const low = w.toLowerCase().replace(/[.'’-]+$/, "");
    if (LATIN_KEEP.has(low)) return false;
    if (INTERJECTIONS.has(low)) return false;
    // allow ALL-CAPS initialisms up to 4 chars (NASA covered above anyway)
    if (/^[A-Z]{2,4}$/.test(w)) return false;
    return true;
  });
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** A cue needs repair when it holds script that doesn't match the target. */
function needsRepair(text: string, target: TargetLang): boolean {
  if (!text.trim()) return true;
  if (target === "Arabic (Modern Standard, natural spoken style)") {
    // mixed line is fine ONLY if the Latin part is whitelisted; any stray
    // latin word (like "gentleman") ⇒ repair. Fully-latin ⇒ repair.
    return latinStragglers(text).length > 0;
  }
  return hasArabic(text); // English target must not carry Arabic leftovers
}

type TargetLang = "Arabic (Modern Standard, natural spoken style)" | "English";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildPrompt(lines: string[], targetLang: TargetLang): string {
  return [
    `Translate each numbered subtitle line below into natural ${targetLang}.`,
    ``,
    `Rules:`,
    `- Keep the exact same numbering, one translated line per input line.`,
    `- These are dialogue subtitles: translate meaning, keep it short and natural for reading.`,
    `- TRANSLATE EVERY WORD. Never leave any ${targetLang.startsWith("Arabic") ? "English" : "non-target-language"} words in your output except universal abbreviations (NASA, TV, DNA, FBI, USB, GPS, Wi-Fi, OK, E.T., Dr., Xbox).`,
    `  - e.g. "gentleman" → "السيد الفاضل", "making fun of" → "يستهزأ بـ", "Really?" → "حقاً؟", brand names → transliterate (Grape-Nuts → غريب ناتس).`,
    `- Translate speaker labels too: "PENNY:" → "بيني:".`,
    `- Keep leading dialogue dashes ("- ") and keep [bracketed] sound tags as-is.`,
    `- Do NOT merge, split, skip, reorder or add lines.`,
    `- If a line is already in ${targetLang.startsWith("Arabic") ? "Arabic" : "English"}, output it unchanged.`,
    `- Output ONLY the numbered lines, nothing else. No preamble, no notes.`,
    ``,
    ...lines.map((l, i) => `${i + 1}. ${l.replace(/\n/g, " ")}`),
  ].join("\n");
}

function parseNumbered(reply: string, expected: number): (string | null)[] | null {
  const map = new Map<number, string>();
  for (const raw of reply.split("\n")) {
    const m = raw.match(/^\s*(\d{1,4})[.)]\s?(.*)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= expected && !map.has(n)) map.set(n, m[2].trim());
    }
  }
  if (map.size < Math.ceil(expected * 0.8)) return null; // catastrophic → caller splits
  const out: (string | null)[] = [];
  for (let i = 1; i <= expected; i++) out.push(map.get(i) ?? null); // null ⇒ repair pass
  return out;
}

export interface TranslateProgress {
  done: number;
  total: number;
}

/**
 * Translate dialogue cue texts (already extracted from a synced srt).
 * Returns cues with `text` replaced by the translated language.
 * Guarantees (best-effort, 2 repair rounds): no empty cues, no mixed-script
 * leftovers; source text survives only if repair fails.
 */
export async function translateCues(
  cues: SubtitleCue[],
  targetLang: TargetLang,
  onProgress?: (p: TranslateProgress) => void
): Promise<SubtitleCue[]> {
  const zai = await ZAI.create();

  const texts = cues.map((c) => c.text);
  const batches = chunk(texts, BATCH_SIZE);
  const results: (string | null)[][] = new Array(batches.length);

  let done = 0;
  let cursor = 0;

  const callModel = async (prompt: string, fixup?: { prev: string }): Promise<string> => {
    const messages: { role: "assistant" | "user"; content: string }[] = [
      {
        role: "assistant",
        content:
          "You are a professional subtitle translator for streaming services. You translate dialogue lines accurately, briefly and naturally, always preserving line numbering exactly.",
      },
      { role: "user", content: prompt },
    ];
    if (fixup) {
      messages.push({ role: "assistant", content: fixup.prev.slice(0, 4000) });
      messages.push({
        role: "user",
        content: `Your reply was missing or malformed for some numbered lines. Re-output ALL numbered lines in order, numbering first, translation only.`,
      });
    }
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    return completion.choices[0]?.message?.content ?? "";
  };

  /** translate one batch; on catastrophic parse failure split and recurse */
  const translateBatch = async (lines: string[], depth = 0): Promise<(string | null)[]> => {
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      try {
        const prompt = buildPrompt(lines, targetLang);
        const reply = await callModel(prompt);
        let parsed = parseNumbered(reply, lines.length);
        if (!parsed) {
          const fixReply = await callModel(prompt, { prev: reply });
          parsed = parseNumbered(fixReply, lines.length);
        }
        if (parsed) return parsed;
      } catch {
        /* retry */
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
    }
    // still garbage → halve & recurse (depth guard), else give up (nulls)
    if (lines.length > 1 && depth < 3) {
      const mid = Math.ceil(lines.length / 2);
      const [a, b] = await Promise.all([
        translateBatch(lines.slice(0, mid), depth + 1),
        translateBatch(lines.slice(mid), depth + 1),
      ]);
      return [...a, ...b];
    }
    return lines.map(() => null);
  };

  async function worker() {
    while (cursor < batches.length) {
      const bi = cursor++;
      results[bi] = await translateBatch(batches[bi]);
      done++;
      onProgress?.({ done, total: batches.length });
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, batches.length) }, () => worker());
  await Promise.all(workers);

  // ── REPAIR PASS: hunt every empty / wrong-script straggler ──
  const flat: string[] = new Array(cues.length);
  {
    let i = 0;
    for (const b of results) for (const v of b) flat[i++] = v ?? "";
  }

  const sourceTexts = cues.map((c) => c.text);
  const repairTotal = batches.length; // progress spans main + repair rounds
  for (let round = 0; round < REPAIR_ROUNDS; round++) {
    const pendingIdx: number[] = [];
    for (let i = 0; i < flat.length; i++) {
      if (needsRepair(flat[i], targetLang)) pendingIdx.push(i);
    }
    if (pendingIdx.length === 0) break;
    console.log(
      `[subs-repair] round ${round}${round > 0 ? " (hard)" : ""}: ${pendingIdx.length}/${flat.length} cues need repair`
    );

    // rounds 1+ = HARD MODE: the model is told every Latin letter is rejected
    // and names/brands MUST be transliterated phonetically (Koothrappali →
    // كوثرابالي, inhaler → بخاخ). Without this the model keeps stubborn words.
    // Round 2+ additionally drops to ONE line per call — zero ambiguity, the
    // model cannot echo-skip embedded English inside an Arabic-majority batch.
    const hard = round > 0;
    const perLine = round >= 2;
    const micro = perLine ? chunk(pendingIdx, 1) : chunk(pendingIdx, 15);
    let mdone = 0;
    const report = () => {
      // blend micro-batch progress into the tail (0.85 → 0.99)
      const tail = 0.85 + 0.14 * (mdone / micro.length);
      onProgress?.({ done: Math.round(repairTotal * tail), total: repairTotal });
    };
    report();

    await Promise.all(
      Array.from({ length: Math.min(3, micro.length) }, async () => {
        while (mdone < micro.length) {
          const mi = mdone++;
          const idxs = micro[mi];
          const lines = idxs.map((i) => flat[i] || sourceTexts[i]);
          const stragglerBefore = idxs.map((i) => latinStragglers(flat[i]).length);
          try {
            let prompt = buildPrompt(lines, targetLang);
            if (hard) {
              prompt +=
                `\n\nFINAL QUALITY CHECK — your previous output for these lines was REJECTED because it still contained ${targetLang.startsWith("Arabic") ? "English/Latin" : "Arabic"} letters.\n` +
                `Rewrite EVERY line fully in ${targetLang.startsWith("Arabic") ? "Arabic script" : "English"}. ` +
                `Transliterate names and brands phonetically (${targetLang.startsWith("Arabic") ? "e.g. Koothrappali → كوثرابالي, inhaler → بخاخ, Penny → بيني" : "e.g.noop"}). ` +
                `Any line containing forbidden script will be rejected again.`;
            }
            let parsed: (string | null)[] | null = null;
            for (let a = 0; a < 2 && !parsed; a++) {
              const reply = await callModel(prompt, a === 1 ? { prev: "" } : undefined);
              parsed = parseNumbered(reply, lines.length);
            }
            if (parsed) {
              idxs.forEach((idx, k) => {
                const v = parsed![k];
                if (!v) return;
                // accept when script-match is clean, or when stragglers
                // strictly decrease (progress beats stagnation on stubborn
                // names — hard-mode transliteration usually lands clean)
                const before = stragglerBefore[k];
                const after = latinStragglers(v).length;
                if (!needsRepair(v, targetLang) || (hard && after < before)) {
                  flat[idx] = v;
                }
              });
            }
          } catch {
            /* keep current value */
          }
          report();
        }
      })
    );
  }
  {
    const remaining = flat.filter((v) => needsRepair(v, targetLang)).length;
    console.log(`[subs-repair] done → ${remaining} cue(s) still unmatched (source kept as last resort)`);
  }

  // final merge: repaired value wins; keep source only as absolute last resort
  return cues.map((c, i) => ({
    ...c,
    text: flat[i] || c.text,
  }));
}
