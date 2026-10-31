"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getRelations } from "@/lib/anime/anilist";
import type { RelatedAnime } from "@/lib/anime/types";

type Family = {
  /** Chronological season number for TV/ONA entries (1-based), null for extras. */
  seasonNumber: number | null;
  item: RelatedAnime | null; // null = the title currently being viewed
};

function isSeasonEntry(item: RelatedAnime): boolean {
  return item.type === "TV" || item.type === "ONA";
}

function label(entry: Family, currentTitle: string): string {
  if (!entry.item) {
    const match = currentTitle.match(/\b(?:season|part|cour)\s*(\d+)\b/i);
    if (match) return `S${match[1]}`;
    const ordinal = currentTitle.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/i);
    if (ordinal) return `S${ordinal[1]}`;
    return entry.seasonNumber ? `S${entry.seasonNumber}` : "Now";
  }

  const { item } = entry;
  if (isSeasonEntry(item)) {
    if (entry.seasonNumber) return `S${entry.seasonNumber}`;
    const match = item.title.match(/\b(?:season|part|cour)\s*(\d+)\b/i);
    return match ? `S${match[1]}` : "Season";
  }
  if (item.type === "MOVIE") return "Movie";
  if (item.type === "OVA") return "OVA";
  if (item.type === "SPECIAL") return "Special";
  return "More";
}

function TabsSkeleton() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-8 w-12 rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Season tabs: TV/ONA entries numbered chronologically (S1 → SN), extras
 * (movies, OVAs, specials) grouped after them. Every tab is a link to that
 * entry's page, which is where its own episode grid lives.
 */
export function SeasonSwitcher({
  id,
  title,
  year,
  type,
}: {
  id: number;
  title: string;
  year?: number | null;
  type?: string | null;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["relations", id],
    queryFn: () => getRelations(id),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) return <TabsSkeleton />;
  if (isError || !data || data.length === 0) return null;

  const currentIsSeason = type === "TV" || type === "ONA" || type === "SPECIAL" || type == null;

  const seasons: { year: number; item: RelatedAnime | null }[] = data
    .filter(isSeasonEntry)
    .map((item) => ({ year: item.year ?? 9999, item }));
  if (currentIsSeason) seasons.push({ year: year ?? 8888, item: null });
  seasons.sort((a, b) => a.year - b.year || (a.item?.id ?? 0) - (b.item?.id ?? 0));

  const families: Family[] = [
    ...seasons.map((entry, index) => ({
      seasonNumber: index + 1,
      item: entry.item,
    })),
    ...data
      .filter((item) => !isSeasonEntry(item))
      .map((item) => ({ seasonNumber: null, item })),
  ];

  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {families.map((entry) => {
        const text = label(entry, title);
        const key = entry.item ? `${entry.item.relationType}-${entry.item.id}` : `current-${id}`;
        const fullTitle = entry.item?.title ?? title;

        if (!entry.item) {
          return (
            <span
              key={key}
              aria-current="page"
              title={fullTitle}
              className="aa-pill shrink-0"
              data-active="true"
            >
              {text}
            </span>
          );
        }

        return (
          <Link
            key={key}
            href={`/anime/${entry.item.id}`}
            prefetch={false}
            title={fullTitle}
            className="aa-pill shrink-0 hover:text-white"
          >
            {text}
          </Link>
        );
      })}
    </div>
  );
}
