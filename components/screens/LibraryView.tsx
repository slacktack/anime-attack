"use client";
import { PageHeader } from "@/components/ui/PageHeader";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFavorites, getContinueWatching } from "@/lib/storage/store";
import { PosterCard } from "@/components/ui/PosterCard";
import type { AnimeSummary } from "@/lib/anime/types";

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function LibraryView() {
  const [favs, setFavs] = useState<AnimeSummary[]>([]);
  const [cw, setCw] = useState<ReturnType<typeof getContinueWatching>>([]);

  useEffect(() => {
    setFavs(getFavorites());
    setCw(getContinueWatching());
  }, []);

  return (
    <div className="aa-gutter pb-12 pt-4 lg:pt-8">
      <PageHeader title="My list" subtitle="What you saved and what you're partway through." />

      {cw.length > 0 && (
        <section className="mb-10">
          <h2 className="aa-section-title mb-3">Continue watching</h2>
          <div className="aa-grid">
            {cw.map((p) => (
              <PosterCard
                key={p.anime.id}
                anime={p.anime}
                fluid
                badge={p.episode > 0 ? `EP ${p.episode}` : undefined}
                href={
                  p.malId
                    ? `/watch/${slugify(p.anime.title)}-episode-${Math.max(1, p.episode)}?mal=${p.malId}&ep=${Math.max(1, p.episode)}&audio=sub`
                    : `/anime/${p.anime.id}`
                }
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="aa-section-title mb-3">
          Saved
          {favs.length > 0 && <span className="text-[13px] font-medium tracking-normal text-muted">{favs.length}</span>}
        </h2>
        {favs.length === 0 ? (
          <div className="py-14 text-center">
            <p className="font-display text-[20px] font-bold">Your list is empty</p>
            <p className="mx-auto mt-1 max-w-[320px] text-[14px] text-muted">
              Press + on any show and it lands here, ready for later.
            </p>
            <Link href="/browse" className="aa-cta mt-5">
              Find something to watch
            </Link>
          </div>
        ) : (
          <div className="aa-grid">
            {favs.map((a) => (
              <PosterCard key={a.id} anime={a} fluid />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
