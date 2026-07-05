import Link from "next/link";
import { Star } from "lucide-react";
import type { AnimeSummary } from "@/lib/anime/types";
import { Card3D } from "./Card3D";

export function PosterCard({ anime }: { anime: AnimeSummary }) {
  return (
    <Link href={`/anime/${anime.id}`} className="block w-32 shrink-0 sm:w-40">
      <Card3D className="nb-card overflow-hidden bg-ink-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={anime.cover}
          alt={anime.title}
          loading="lazy"
          className="aspect-[2/3] w-full object-cover"
        />
        <div className="border-t-2 border-nb-border bg-ink-800 p-2">
          <p className="font-display text-xs font-bold leading-tight line-clamp-2">
            {anime.title}
          </p>
          {anime.score != null && (
            <span className="nb-tag mt-1 gap-0.5 text-accent-gold">
              <Star size={10} color="currentColor" fill="currentColor" />{" "}
              {anime.score}
            </span>
          )}
        </div>
      </Card3D>
    </Link>
  );
}
