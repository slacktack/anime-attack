"use client";

import Link from "next/link";
import type { SeasonEntry } from "@/lib/client/api";

export type Franchise = { key: number; seasons: SeasonEntry[]; extras: SeasonEntry[] };

export function franchiseName(f: Franchise): string {
  const first = f.seasons[0] ?? f.extras[0];
  return (first?.title ?? "").replace(/[:\s-]*(season|part|cour)\s*\d+.*$/i, "").replace(/\s*\(\d{4}\)$/, "");
}

// One card for a whole show: every season and movie as a jump-off chip.
export function FranchiseCard({ franchise }: { franchise: Franchise }) {
  const { seasons, extras } = franchise;
  const lead = seasons[0] ?? extras[0];
  if (!lead) return null;
  const years = seasons.map((s) => s.year).filter(Boolean) as number[];
  const span = years.length ? (years[0] === years[years.length - 1] ? `${years[0]}` : `${years[0]} to ${years[years.length - 1]}`) : null;
  const totalEps = seasons.reduce((n, s) => n + (s.episodes ?? 0), 0);

  return (
    <article className="on-media relative overflow-hidden rounded-xl bg-ink-800">
      {lead.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lead.cover} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl saturate-150" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
      <div className="relative flex gap-4 p-4 sm:gap-6 sm:p-6">
        <Link href={`/anime/${lead.id}`} className="poster-frame block aspect-[2/3] w-[92px] shrink-0 rounded-lg ring-1 ring-white/10 sm:w-[132px]">
          {lead.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lead.cover} alt={lead.title} className="h-full w-full object-cover" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/anime/${lead.id}`} className="hover:underline">
            <h3 className="aa-billboard-title text-[28px] text-white sm:text-[40px]">{franchiseName(franchise)}</h3>
          </Link>
          <p className="mt-2 text-[13.5px] text-white/75">
            {[
              seasons.length ? `${seasons.length} season${seasons.length > 1 ? "s" : ""}` : null,
              extras.length ? `${extras.length} movie${extras.length > 1 ? "s" : ""} & specials` : null,
              totalEps ? `${totalEps} episodes` : null,
              span,
            ]
              .filter(Boolean)
              .join("  /  ")}
          </p>
          <div className="no-scrollbar -mr-4 mt-4 flex gap-2 overflow-x-auto pr-4 sm:flex-wrap sm:overflow-visible">
            {seasons.map((s) => (
              <Link
                key={s.id}
                href={`/anime/${s.id}`}
                title={s.title}
                className="shrink-0 rounded-md bg-white px-3.5 py-2 text-[13.5px] font-bold text-black transition-colors hover:bg-white/80"
              >
                Season {s.season}
              </Link>
            ))}
            {extras.slice(0, 6).map((e) => (
              <Link
                key={e.id}
                href={`/anime/${e.id}`}
                title={e.title}
                className="max-w-[220px] shrink-0 truncate rounded-md bg-white/15 px-3.5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/25"
              >
                {e.title.replace(new RegExp(`^${franchiseName(franchise).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[:\\s-]*`, "i"), "") || e.title}
              </Link>
            ))}
            {extras.length > 6 && (
              <Link href={`/anime/${lead.id}`} className="shrink-0 rounded-md bg-white/10 px-3.5 py-2 text-[13.5px] font-semibold text-white/80">
                +{extras.length - 6} more
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
