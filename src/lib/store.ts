"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { HistoryEntry, MediaType, SubLang, UILang, WatchlistItem } from "@/types";
import { sanitizePreferredServer } from "@/lib/servers";

// ─── Settings · lang en default, subtitles user-opt-in, server memory ───────

interface SettingsState {
  lang: UILang;
  subLang: SubLang;
  subOffset: number; // seconds
  subSize: number; // px
  subStyle: "outline" | "boxed";
  preferredServer: string | null;
  setLang: (l: UILang) => void;
  setSubLang: (l: SubLang) => void;
  setSubOffset: (n: number) => void;
  nudgeSubOffset: (d: number) => void;
  setSubSize: (n: number) => void;
  setSubStyle: (s: "outline" | "boxed") => void;
  setPreferredServer: (id: string | null) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "en", // English default (user requirement)
      // Subtitles ship DISABLED — the viewer decides whether (and what) to
      // turn on. Nothing auto-plays captions anymore (user requirement).
      subLang: "off",
      subOffset: 0,
      subSize: 28,
      subStyle: "outline",
      preferredServer: null,
      setLang: (lang) => set({ lang }),
      setSubLang: (subLang) => set({ subLang }),
      setSubOffset: (subOffset) => set({ subOffset }),
      nudgeSubOffset: (d) => set((s) => ({ subOffset: Math.round((s.subOffset + d) * 10) / 10 })),
      setSubSize: (subSize) => set({ subSize: Math.min(52, Math.max(16, Math.round(subSize))) }),
      setSubStyle: (subStyle) => set({ subStyle }),
      setPreferredServer: (preferredServer) => set({ preferredServer }),
    }),
    {
      name: "senku-settings",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // v2: frameXTV's embed falls back to a backup player that hard-fails
      // behind a "Please Disable Sandbox" screen. Reset stale frameXTV
      // preferences (and any unknown ids) so the verified-first order applies.
      // v3: subtitles are now user-opt-in — every stored "ar" was set by the
      // old auto-force policy, never by a real user choice, so it resets to
      // OFF. From here on the viewer's explicit pick persists as-is.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          lang: p.lang ?? "en",
          subLang: version >= 3 ? (p.subLang ?? "off") : "off",
          subOffset: p.subOffset ?? 0,
          subSize: p.subSize ?? 28,
          subStyle: p.subStyle ?? "outline",
          preferredServer: sanitizePreferredServer(p.preferredServer),
        } as SettingsState;
      },
    }
  )
);

// ─── Watchlist ───────────────────────────────────────────────────────────────

interface WatchlistState {
  items: WatchlistItem[];
  has: (imdbId: string) => boolean;
  toggle: (item: Omit<WatchlistItem, "addedAt">) => void;
  remove: (imdbId: string) => void;
  clear: () => void;
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (imdbId) => get().items.some((i) => i.imdbId === imdbId),
      toggle: (item) =>
        set((s) =>
          s.items.some((i) => i.imdbId === item.imdbId)
            ? { items: s.items.filter((i) => i.imdbId !== item.imdbId) }
            : { items: [{ ...item, addedAt: Date.now() }, ...s.items] }
        ),
      remove: (imdbId) => set((s) => ({ items: s.items.filter((i) => i.imdbId !== imdbId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "senku-watchlist", storage: createJSONStorage(() => localStorage) }
  )
);

// ─── Watch history / continue watching ───────────────────────────────────────

interface HistoryState {
  entries: Record<string, HistoryEntry>;
  upsert: (entry: Omit<HistoryEntry, "updatedAt">) => void;
  get: (imdbId: string) => HistoryEntry | undefined;
  remove: (imdbId: string) => void;
  clear: () => void;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: {},
      upsert: (entry) =>
        set((s) => ({
          entries: {
            ...s.entries,
            [entry.imdbId]: { ...entry, updatedAt: Date.now() },
          },
        })),
      get: (imdbId) => get().entries[imdbId],
      remove: (imdbId) =>
        set((s) => {
          const next = { ...s.entries };
          delete next[imdbId];
          return { entries: next };
        }),
      clear: () => set({ entries: {} }),
    }),
    { name: "senku-history", storage: createJSONStorage(() => localStorage) }
  )
);

// Convenience hook to read sorted recent history
export function useRecentHistory(limit = 12): HistoryEntry[] {
  const entries = useHistory((s) => s.entries);
  return Object.values(entries)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

// ─── Media type helper ───────────────────────────────────────────────────────
export function mediaTypeOf(t: string): MediaType {
  return t === "series" ? "series" : "movie";
}
