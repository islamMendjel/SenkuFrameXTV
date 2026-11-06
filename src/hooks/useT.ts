"use client";

import { useMemo } from "react";
import { useSettings } from "@/lib/store";
import { makeT } from "@/lib/i18n";

// ─── useT · referentially-stable translator (prevents effect churn) ──────────

export function useT() {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}
