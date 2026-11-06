"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSettings, useWatchlist } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { Bookmark, Download, Languages, Moon, Search, Sun } from "lucide-react";
// ─── Navbar · glass cinematic header, bilingual + theme toggles ──────────────

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const lang = useSettings((s) => s.lang);
  const setLang = useSettings((s) => s.setLang);
  const watchlistCount = useWatchlist((s) => s.items.length);
  const { theme, setTheme } = useTheme();
  const { canInstall, install } = usePWAInstall();
  const t = useT();

  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 450);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // live-search: navigate to /search?q= as you type
  useEffect(() => {
    const q = debounced.trim();
    if (q.length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
  }, [debounced, router]);

  // theme icon via CSS (no mounted state → no hydration flicker)
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass border-b border-border/50 shadow-lg" : "bg-gradient-to-b from-background/95 to-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-10" aria-label="Main">
        {/* logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={t("appName")}>
          <Image
            src="/logo.png"
            alt={t("appName")}
            width={34}
            height={34}
            className="rounded-lg shadow-[0_0_16px_rgba(16,185,129,0.35)]"
            priority
          />
          <span className="text-lg font-black tracking-tight">
            <span className="text-primary neon-text">Senku</span>
            <span className="text-foreground">-frame</span>
            <span className="text-primary">XTV</span>
          </span>
        </Link>

        {/* desktop search */}
        <div className="relative ms-2 hidden flex-1 max-w-md md:block">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className="h-10 w-full rounded-full border border-border/60 bg-card/60 ps-10 pe-4 text-sm outline-none backdrop-blur-md transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-card focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex-1 md:hidden" />

        {/* actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* mobile search */}
          <Link
            href="/search"
            aria-label={t("search")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground md:hidden"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>

          {/* install */}
          {canInstall && (
            <button
              onClick={install}
              className="hidden min-h-[36px] items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/25 sm:flex"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {t("install")}
            </button>
          )}

          {/* watchlist */}
          <Link
            href="/watchlist"
            aria-label={t("watchlist")}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-card",
              pathname === "/watchlist" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bookmark className="h-5 w-5" aria-hidden />
            {watchlistCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-black">
                {watchlistCount > 99 ? "99+" : watchlistCount}
              </span>
            )}
          </Link>

          {/* language */}
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex min-h-[36px] items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-black transition-all hover:border-primary/50 hover:text-primary"
            aria-label={t("language")}
            title={t("language")}
          >
            <Languages className="h-4 w-4" aria-hidden />
            {lang === "en" ? "عربي" : "EN"}
          </button>

          {/* theme (dark by default) */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-primary"
            aria-label={t("theme")}
            title={t("theme")}
          >
            <Sun className="hidden h-5 w-5 dark:block" aria-hidden />
            <Moon className="h-5 w-5 dark:hidden" aria-hidden />
          </button>
        </div>
      </nav>
    </header>
  );
}
