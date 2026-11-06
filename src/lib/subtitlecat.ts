import "server-only";

// ─── SubtitleCat · keyless English subtitle source (release-matched) ─────────
// SubtitleCat indexes millions of release-specific .srt files. Searching an
// S/E-qualified title returns the closest release pages; each detail page
// exposes a direct `-orig.srt` download whose timings match the release the
// embed players stream. We use it as the base for the Arabic AI translation
// pipeline (perfect sync) and as an English fallback source.

const BASE = "https://www.subtitlecat.com";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export interface SubcatHit {
  pageUrl: string;
  releaseName: string;
}

/** Slugify a title the way SubtitleCat indexes releases (dots between words). */
function titleQuery(name: string, season?: number, episode?: number): string {
  const base = name.toLowerCase().replace(/['’,:]/g, "").replace(/\s+/g, " ").trim();
  if (season && episode) {
    // both "s08e21" and "8x21" styles are indexed
    return `${base} s${String(season).padStart(2, "0")}e${String(episode).padStart(2, "0")}`;
  }
  return base;
}

/** Score a result page against what we asked for (S/E + language hints). */
function scoreRelease(release: string, season?: number, episode?: number): number {
  const r = release.toLowerCase();
  let score = 0;
  if (season && episode) {
    const sePadded = `s${String(season).padStart(2, "0")}e${String(episode).padStart(2, "0")}`;
    const seShort = `${season}x${String(episode).padStart(2, "0")}`;
    if (r.includes(sePadded)) score += 100;
    if (r.includes(seShort)) score += 80;
    if (r.includes(`s${season}e${episode}`)) score += 80;
  }
  if (/\b(720p|1080p|bluray|blu-ray|web-?dl|webrip|hdtv)\b/.test(r)) score += 20;
  if (/\b(cam|ts|telesync|hdts)\b/.test(r)) score -= 40;
  return score;
}

/** Search SubtitleCat and return ranked release hits for the title. */
export async function searchReleases(
  name: string,
  season?: number,
  episode?: number
): Promise<SubcatHit[]> {
  const q = encodeURIComponent(titleQuery(name, season, episode));
  const res = await fetch(`${BASE}/index.php?search=${q}`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const hits: SubcatHit[] = [];
  const re = /href="(subs\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const pageUrl = `${BASE}/${m[1].replace(/&amp;/g, "&")}`;
    const releaseName = decodeEntities(m[2]).trim();
    hits.push({ pageUrl, releaseName });
  }
  // de-dup by release name
  const seen = new Set<string>();
  const unique = hits.filter((h) =>
    seen.has(h.releaseName) ? false : (seen.add(h.releaseName), true)
  );
  return unique
    .map((h) => ({ ...h, _s: scoreRelease(h.releaseName, season, episode) }))
    .filter((h) => (h as { _s: number })._s > 0 || !season || !episode)
    .sort((a, b) => (b as { _s: number })._s - (a as { _s: number })._s)
    .slice(0, 5);
}

/**
 * Download the original srt for a detail page. The detail HTML links the
 * original file as `<release>-orig.srt` inside the same folder.
 */
export async function fetchOriginalSrt(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // the page defines the translation target file: '<name>-orig.srt', '/subs/NN/'
    const m =
      html.match(/['"]([^'"]*?)-orig\.srt['"],\s*['"]([^'"]+)['"]/) ??
      html.match(/href="([^"]+-orig\.srt)"/);
    let url: string | null = null;
    if (m) {
      let file: string;
      if (m[1].endsWith("-orig.srt")) {
        // href-style match: full path already includes the suffix
        file = m[1];
      } else {
        // translate_from_server_folder('ar', '<release>-orig.srt', '/subs/NN/')
        file = `${m[2].replace(/\/$/, "")}/${m[1]}-orig.srt`;
      }
      url = file.startsWith("http") ? file : `${BASE}${file.startsWith("/") ? "" : "/"}${file}`;
    } else {
      // fallback: derive from page url — /subs/<id>/<Release>.html
      const pm = pageUrl.match(/^(https:\/\/www\.subtitlecat\.com\/subs\/[^/]+)\/(.+)\.html$/);
      if (pm) url = `${pm[1]}/${pm[2]}-orig.srt`;
    }
    if (!url) return null;
    const dl = await fetch(url.replace(/ /g, "%20"), {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!dl.ok) return null;
    const text = await dl.text();
    if (!text.includes("-->") && !/^\d+\s*$/m.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * One-shot: find the best release for this title and return its srt text.
 */
export async function fetchBestSrt(
  name: string,
  season?: number,
  episode?: number
): Promise<{ srt: string; release: string } | null> {
  const hits = await searchReleases(name, season, episode);
  for (const hit of hits) {
    const srt = await fetchOriginalSrt(hit.pageUrl);
    if (srt && srt.includes("-->")) {
      return { srt, release: hit.releaseName };
    }
  }
  return null;
}
