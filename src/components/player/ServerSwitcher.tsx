"use client";

import { memo } from "react";
import { SERVERS } from "@/lib/servers";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// ─── ServerSwitcher · quick failover chips under the player ──────────────────

interface Props {
  activeId: string;
  loading: boolean;
  slow: boolean;
  onSelect: (id: string) => void;
  t: (k: string) => string;
}

function ServerSwitcherBase({ activeId, loading, slow, onSelect, t }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t("servers")}>
      <span className="me-1 hidden text-xs font-medium uppercase tracking-wider text-muted-foreground sm:inline">
        {t("servers")}:
      </span>
      {SERVERS.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            onClick={() => !active && onSelect(s.id)}
            className={cn(
              "group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
              "min-h-[32px] touch-manipulation",
              active
                ? "border-primary/60 bg-primary/15 text-primary neon-ring"
                : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
            title={`${s.name} ${s.tag ?? ""} · ${s.quality}`}
          >
            {active && loading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "bg-primary" : slow ? "bg-amber-400 animate-pulse-glow" : "bg-muted-foreground/50"
                )}
              />
            )}
            {s.name}
            {s.tag && <span className="opacity-60">· {s.tag}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const ServerSwitcher = memo(ServerSwitcherBase);
