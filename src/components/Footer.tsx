"use client";

import Link from "next/link";
import Image from "next/image";
import { useSettings } from "@/lib/store";
import { useT } from "@/hooks/useT";

// ─── Footer · sticky bottom (mt-auto pattern in layout) ──────────────────────

export function Footer() {
  const t = useT();

  return (
    <footer className="mt-auto border-t border-border/50 bg-card/30">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-between sm:py-5 sm:text-start">
        <Link href="/" className="flex items-center gap-2" aria-label={t("appName")}>
          <Image src="/logo.png" alt="" width={26} height={26} className="rounded-md" />
          <span className="text-sm font-black">
            <span className="text-primary">Senku</span>
            <span className="text-foreground">-frame</span>
            <span className="text-primary">XTV</span>
          </span>
        </Link>

        <p className="text-[11px] font-medium text-muted-foreground">{t("footerTag")}</p>

        <p className="max-w-xs text-[10px] leading-relaxed text-muted-foreground/60">
          {t("footerDisclaimer")}
        </p>
      </div>
    </footer>
  );
}
