"use client";

import type { Meta } from "@/types";
import { useSettings } from "@/lib/store";
import { displayName } from "@/lib/i18n";
import { useT } from "@/hooks/useT";

// ─── InfoGrid · storyline + cast + metadata grid (bilingual labels) ──────────

export function InfoGrid({ meta }: { meta: Meta }) {
  const t = useT();

  const rows: { label: string; value: string }[] = [];
  if (meta.director?.length) rows.push({ label: t("director"), value: meta.director.join(", ") });
  if (meta.cast?.length) rows.push({ label: t("cast"), value: meta.cast.slice(0, 6).join(", ") });
  if (meta.genres?.length) rows.push({ label: t("genre"), value: meta.genres.join(", ") });
  if (meta.country) rows.push({ label: t("country"), value: meta.country });
  if (meta.releaseInfo) rows.push({ label: t("releaseYear"), value: meta.releaseInfo });
  if (meta.awards) rows.push({ label: t("awards"), value: meta.awards });

  return (
    <section className="grid gap-6 lg:grid-cols-3" aria-label={t("story")}>
      <div className="space-y-3 lg:col-span-2">
        <h2 className="text-lg font-extrabold tracking-tight">{t("story")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground" dir="auto">
          {meta.description ?? t("empty")}
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-border/50 bg-card/40 p-5">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-3 border-b border-border/30 py-2 text-[13px] last:border-0">
            <span className="w-24 shrink-0 font-bold text-muted-foreground">{r.label}</span>
            <span className="min-w-0 flex-1" dir="auto">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
