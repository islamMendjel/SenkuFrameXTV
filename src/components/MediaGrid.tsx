"use client";

import type { Meta } from "@/types";
import { MediaCard } from "./MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── MediaGrid · responsive poster grid ──────────────────────────────────────

interface Props {
  metas: Meta[];
  loading?: boolean;
  count?: number;
  className?: string;
}

export function MediaGrid({ metas, loading, count = 18, className }: Props) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 sm:gap-4 sm:px-6 lg:grid-cols-6 lg:px-10 xl:grid-cols-7", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 sm:gap-4 sm:px-6 lg:grid-cols-6 lg:px-10 xl:grid-cols-7", className)}>
      {metas.map((m) => (
        <MediaCard key={m.imdb_id + m.type} meta={m} />
      ))}
    </div>
  );
}
