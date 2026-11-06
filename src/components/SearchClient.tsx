"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Meta } from "@/types";
import { useSettings } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { useDebounce } from "@/hooks/useDebounce";
import { MediaGrid } from "@/components/MediaGrid";
import { Search, X } from "lucide-react";

// ─── SearchClient · debounced live search (English & Arabic queries) ─────────

export function SearchClient() {
  const params = useSearchParams();
  const t = useT();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const debounced = useDebounce(query, 400);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // adopt external navigations (navbar search) without clobbering local typing
  // (official "adjust state on prop change" render-time pattern)
  const urlQ = params.get("q") ?? "";
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    if (urlQ && urlQ !== query) setQuery(urlQ);
  }

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) return;
    let cancelled = false;
    // loading flag on a microtask (keeps the effect body side-effect free)
    void Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { metas?: Meta[] }) => {
        if (!cancelled) setMetas(d.metas ?? []);
      })
      .catch(() => !cancelled && setMetas([]))
      .finally(() => !cancelled && setLoading(false));
    // keep URL shareable (external to React state → no loop)
    window.history.replaceState(null, "", `/search?q=${encodeURIComponent(q)}`);
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const q = debounced.trim();

  return (
    <div className="space-y-6">
      <div className="px-4 sm:px-6 lg:px-10">
        <h1 className="sr-only">{t("search")}</h1>
        <div className="relative max-w-2xl">
          <Search
            className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            dir="auto"
            className="h-12 w-full rounded-2xl border border-border/60 bg-card/60 ps-12 pe-11 text-sm font-medium outline-none backdrop-blur-md transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-card focus:ring-2 focus:ring-primary/30"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="clear"
              className="absolute end-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        {q.length >= 2 && (
          <p className="mt-3 text-xs font-semibold text-muted-foreground">
            {loading ? t("loading") + "…" : metas.length > 0 ? `${t("resultsFor")} "${q}"` : `${t("noResults")} "${q}"`}
          </p>
        )}
        {q.length < 2 && <p className="mt-3 text-xs text-muted-foreground">{t("searchHint")}</p>}
      </div>

      <MediaGrid metas={q.length >= 2 ? metas : []} loading={loading && q.length >= 2} count={14} />
    </div>
  );
}
