import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "@/components/SearchClient";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-0 pb-10 pt-24 sm:pt-24">
      <Suspense>
        <SearchClient />
      </Suspense>
    </div>
  );
}
