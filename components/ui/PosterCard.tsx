import Link from "next/link";
import { Star } from "lucide-react";
import type { AnimeSummary } from "@/lib/anime/types";

export function PosterCard({
  anime,
  href,
  badge,
  progress,
  fluid = false,
}: {
  anime: AnimeSummary;
  href?: string;
  badge?: string;
  progress?: number;
  fluid?: boolean;
}) {
  return (
    <Link
      href={href ?? `/anime/${anime.id}`}
      prefetch={false}
      className={`group block shrink-0 ${fluid ? "w-full" : "aa-poster-w"}`}
    >
      <div className="poster-frame aspect-[2/3] ring-1 ring-inset ring-white/[0.06]">
        {anime.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={anime.cover}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center p-3 text-center font-display text-[15px] font-bold leading-tight text-white/40">
            {anime.title}
          </span>
        )}
        {badge && (
          <span className="on-media absolute left-1.5 top-1.5 rounded-[5px] bg-black/75 px-1.5 py-0.5 text-[10.5px] font-bold text-white">
            {badge}
          </span>
        )}
        {progress != null && (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
            <span className="block h-full bg-accent-purple" style={{ width: `${Math.max(4, Math.min(100, progress))}%` }} />
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90 transition-colors group-hover:text-white">
        {anime.title}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
        {anime.score != null && (
          <span className="flex items-center gap-0.5 font-semibold text-accent-gold">
            <Star size={10} fill="currentColor" />
            {anime.score.toFixed(1)}
          </span>
        )}
        {anime.year && <span>{anime.year}</span>}
        {anime.type && anime.type !== "TV" && <span>{anime.type === "MOVIE" ? "Movie" : anime.type}</span>}
      </p>
    </Link>
  );
}
