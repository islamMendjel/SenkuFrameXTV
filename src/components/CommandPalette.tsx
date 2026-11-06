"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useSettings, useRecentHistory } from "@/lib/store";
import { useT } from "@/hooks/useT";
import type { Meta } from "@/types";
import {
  Bookmark,
  Captions,
  Check,
  Clapperboard,
  Clock,
  Command as CommandIcon,
  Home,
  Languages,
  Moon,
  Search,
  Sun,
} from "lucide-react";

// ─── Senku Command · global ⌘K palette ───────────────────────────────────────
// One keyboard-first surface for everything: instant catalog search (EN/AR),
// resume-from-history deep links, and one-tap toggles for subtitles, UI
// language and theme. Registered globally in Providers.

const MIN_QUERY = 2;

export function CommandPalette() {
  const t = useT();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Meta[]>([]);
  const [searching, setSearching] = useState(false);

  const lang = useSettings((s) => s.lang);
  const setLang = useSettings((s) => s.setLang);
  const subLang = useSettings((s) => s.subLang);
  const setSubLang = useSettings((s) => s.setSubLang);
  const history = useRecentHistory(3);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── global hotkey: ⌘K / Ctrl+K, plus the navbar chip signal event ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onSignal = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("senku:cmdk", onSignal);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("senku:cmdk", onSignal);
    };
  }, []);

  // reset query on close
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => {
        setQuery("");
        setResults([]);
      }, 200);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ── debounced catalog search ──
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { metas?: Meta[] };
        setResults((data.metas ?? []).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const showSearch = query.trim().length >= MIN_QUERY;
  const showStatic = !showSearch;

  const historyEntries = useMemo(() => history, [history]);

  const subItem = (
    value: "ar" | "en" | "off",
    icon: React.ReactNode,
    label: string
  ) => (
    <CommandItem
      value={`sub-${value}`}
      onSelect={() => {
        setSubLang(value);
        setOpen(false);
      }}
      className="gap-2.5"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {subLang === value && <Check className="h-4 w-4 text-primary" aria-hidden />}
    </CommandItem>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogHeader className="sr-only">
        <DialogTitle>{t("cmdOpen")}</DialogTitle>
        <DialogDescription>{t("cmdSearch")}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className="overflow-hidden p-0"
        showCloseButton={false}
        aria-label={t("cmdOpen")}
      >
        <Command
          shouldFilter={false}
          className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
      <CommandInput
        placeholder={t("cmdSearch")}
        value={query}
        onValueChange={setQuery}
        aria-label={t("cmdSearch")}
      />
      <CommandList className="max-h-[min(60vh,420px)]">
        {showSearch && results.length === 0 && (
          <CommandEmpty>
            {searching ? (
              <span className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Clapperboard className="h-4 w-4 animate-pulse" aria-hidden />
                {t("loading")}…
              </span>
            ) : (
              t("cmdNoResults")
            )}
          </CommandEmpty>
        )}

        {/* ── catalog results ── */}
        {showSearch && results.length > 0 && (
          <CommandGroup heading={t("search")}>
            {results.map((m) => (
              <CommandItem
                key={m.imdb_id}
                value={`media-${m.imdb_id}`}
                onSelect={() => go(m.type === "series" ? `/tv/${m.imdb_id}` : `/movie/${m.imdb_id}`)}
                className="gap-3"
              >
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-md border border-border/60 bg-black/40">
                  {m.poster ? (
                    <Image
                      src={m.poster}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <Clapperboard className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {m.type === "series" ? "TV" : "Movie"}
                    {m.releaseInfo ? ` · ${m.releaseInfo}` : ""}
                    {m.imdbRating ? ` · ★ ${m.imdbRating}` : ""}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showSearch && results.length > 0 && <CommandSeparator />}

        {/* ── continue watching (history deep-links) ── */}
        {showStatic && historyEntries.length > 0 && (
          <CommandGroup heading={t("cmdContinue")}>
            {historyEntries.map((h) => {
              const path =
                h.type === "series" && h.season && h.episode
                  ? `/tv/${h.imdbId}/${h.season}/${h.episode}`
                  : `/movie/${h.imdbId}`;
              return (
                <CommandItem key={h.imdbId} value={`hist-${h.imdbId}`} onSelect={() => go(path)} className="gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {h.title}
                    {h.season ? ` · S${h.season}E${h.episode}` : ""}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {h.progressPct}%
                  </span>
                </CommandItem>
              );
            })}
            <CommandSeparator />
          </CommandGroup>
        )}

        {/* ── navigation ── */}
        {showStatic && (
          <CommandGroup heading={t("cmdNav")}>
            <CommandItem value="nav-home" onSelect={() => go("/")} className="gap-2.5">
              <Home className="h-4 w-4 text-primary" aria-hidden />
              {t("home")}
            </CommandItem>
            <CommandItem value="nav-search" onSelect={() => go("/search")} className="gap-2.5">
              <Search className="h-4 w-4 text-primary" aria-hidden />
              {t("search")}
            </CommandItem>
            <CommandItem value="nav-watchlist" onSelect={() => go("/watchlist")} className="gap-2.5">
              <Bookmark className="h-4 w-4 text-primary" aria-hidden />
              {t("watchlist")}
            </CommandItem>
          </CommandGroup>
        )}

        {showStatic && <CommandSeparator />}

        {/* ── actions: subtitles / language / theme ── */}
        {showStatic && (
          <CommandGroup heading={t("cmdActions")}>
            {subItem("ar", <Captions className="h-4 w-4 text-primary" aria-hidden />, t("cmdSubAr"))}
            {subItem("en", <Captions className="h-4 w-4 text-primary" aria-hidden />, t("cmdSubEn"))}
            {subItem("off", <Captions className="h-4 w-4 text-muted-foreground" aria-hidden />, t("cmdSubOff"))}
            <CommandItem
              value="ui-lang"
              onSelect={() => {
                setLang(lang === "en" ? "ar" : "en");
                setOpen(false);
              }}
              className="gap-2.5"
            >
              <Languages className="h-4 w-4 text-primary" aria-hidden />
              <span className="flex-1">{t("cmdUiLang")}</span>
              <span className="text-xs text-muted-foreground">
                {lang === "en" ? "EN → عربي" : "عربي → EN"}
              </span>
            </CommandItem>
            <CommandItem
              value="theme-toggle"
              onSelect={() => {
                setTheme(theme === "light" ? "dark" : "light");
                setOpen(false);
              }}
              className="gap-2.5"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <Sun className="h-4 w-4 text-primary" aria-hidden />
              )}
              <span className="flex-1">{t("cmdTheme")}</span>
              <span className="text-xs text-muted-foreground">
                {theme === "light" ? t("cmdThemeDark") : t("cmdThemeLight")}
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
          <CommandIcon className="h-3 w-3" aria-hidden />
          <kbd className="rounded border border-border/60 bg-muted px-1 font-mono">K</kbd>
          {t("cmdHint")}
        </span>
        <span className="text-[10px] font-black uppercase tracking-wide text-primary">Senku</span>
      </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
