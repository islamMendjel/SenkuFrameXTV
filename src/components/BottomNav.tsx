"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Bookmark, Flame, Home, Search } from "lucide-react";

// ─── BottomNav · mobile navigation bar (safe-area aware) ─────────────────────

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();

  const items = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/search", label: t("search"), icon: Search },
    { href: "/#arab-world", label: t("trending"), icon: Flame },
    { href: "/watchlist", label: t("watchlist"), icon: Bookmark },
  ];

  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-50 border-t border-border/50 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Mobile"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href.replace("/#", "/"));
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]")} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
