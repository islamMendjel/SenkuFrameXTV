"use client";

import { useRef } from "react";
import type { Meta } from "@/types";
import { MediaCard } from "./MediaCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSettings } from "@/lib/store";
import { useT } from "@/hooks/useT";
import { DICT, type DictKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ─── Row · horizontal snap scroller section with arrows ──────────────────────

const DICT_KEYS = new Set(Object.keys(DICT.en));

interface Props {
  titleKey?: string;
  title?: string;
  id?: string;
  metas: Meta[];
  icon?: React.ReactNode;
  href?: string; // optional "see all"
}

export function Row({ titleKey, title, id, metas, icon, href }: Props) {
  const t = useT();
  const heading = (titleKey && DICT_KEYS.has(titleKey) ? t(titleKey as DictKey) : title) ?? "";
  const scroller = useRef<HTMLDivElement>(null);
  const lang = useSettings((s) => s.lang);
  const rtl = lang === "ar";

  const scroll = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * (rtl ? -1 : 1) * (scroller.current.clientWidth * 0.85), behavior: "smooth" });
  };

  if (!metas.length) return null;

  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10">
        <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight sm:text-lg">
          {icon && <span className="text-primary">{icon}</span>}
          {heading}
          <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />
        </h2>
        <div className="flex items-center gap-1.5">
          {href && (
            <a
              href={href}
              className="me-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              {lang === "ar" ? "الكل" : "All"}
            </a>
          )}
          <button
            onClick={() => scroll(-1)}
            aria-label="scroll left"
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary sm:flex"
          >
            <ChevronLeft className="h-4 w-4 flip-x" aria-hidden />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="scroll right"
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary sm:flex"
          >
            <ChevronRight className="h-4 w-4 flip-x" aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-pl-4 px-4 pb-2 sm:gap-4 sm:px-6 lg:px-10"
      >
        {metas.map((m) => (
          <MediaCard
            key={m.imdb_id + m.type}
            meta={m}
            className="w-[130px] shrink-0 snap-start sm:w-[150px] lg:w-[165px]"
          />
        ))}
      </div>
    </section>
  );
}
