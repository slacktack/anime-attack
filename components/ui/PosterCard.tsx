import Link from "next/link";
import { Star } from "lucide-react";
import type { AnimeSummary } from "@/lib/anime/types";
import { Card3D } from "./Card3D";

export function PosterCard({ anime }: { anime: AnimeSummary }) {
  return (
    <Link href={`/anime/${anime.id}`} className="block w-32 shrink-0 sm:w-40">
      <Card3D className="group relative overflow-hidden rounded-2xl bg-ink-700 shadow-lg shadow-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={anime.cover} alt={anime.title} loading="lazy"
          className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
          <p className="line-clamp-2 text-xs font-semibold">{anime.title}</p>
          {anime.score != null && (
            <p className="flex items-center gap-0.5 text-[10px] text-accent-gold">
              <Star size={10} color="currentColor" fill="currentColor" /> {anime.score}
            </p>
          )}
        </div>
      </Card3D>
    </Link>
  );
}
