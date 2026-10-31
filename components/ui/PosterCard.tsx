import Link from "next/link";
import { Play, Star } from "lucide-react";
import type { AnimeSummary } from "@/lib/anime/types";

export function PosterCard({ anime }: { anime: AnimeSummary }) {
  return (
    <Link
      href={`/anime/${anime.id}`}
      prefetch={false}
      className="group block w-[124px] shrink-0 sm:w-[150px]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-ink-800 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.95)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-white/25">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={anime.cover}
          alt={anime.title}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
        <div className="aa-scrim-soft pointer-events-none" />

        {anime.score != null && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-lg bg-black/55 px-1.5 py-0.5 text-[9.5px] font-black text-amber-300 backdrop-blur">
            <Star size={8} fill="currentColor" />
            {anime.score}
          </span>
        )}

        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/18 text-white ring-1 ring-white/35 backdrop-blur-md">
            <Play size={13} fill="currentColor" />
          </span>
        </span>

        <div className="absolute inset-x-0 bottom-0 p-2">
          <p className="line-clamp-2 font-display text-[11px] font-bold leading-tight text-white">
            {anime.title}
          </p>
          {(anime.type || anime.year) && (
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
              {[anime.type, anime.year].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
