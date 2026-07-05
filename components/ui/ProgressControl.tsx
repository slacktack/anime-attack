"use client";
import { useEffect, useState } from "react";
import { getSpoilerCeiling, setSpoilerCeiling, recordProgress } from "@/lib/storage/store";
import type { AnimeSummary } from "@/lib/anime/types";

export function ProgressControl({ anime, maxEpisodes }: { anime: AnimeSummary; maxEpisodes: number | null }) {
  const [ep, setEp] = useState(0);
  useEffect(() => setEp(getSpoilerCeiling(anime.id)), [anime.id]);
  function update(next: number) {
    const clamped = Math.max(0, maxEpisodes ? Math.min(next, maxEpisodes) : next);
    setEp(clamped); setSpoilerCeiling(anime.id, clamped); recordProgress(anime, clamped);
  }
  return (
    <div className="nb-card flex items-center gap-3 bg-ink-800 px-4 py-3">
      <span className="nb-tag">EP</span>
      <button onClick={() => update(ep - 1)} className="nb-btn nb-btn-accent h-8 min-h-0 w-8 p-0" data-card-accent="progress">−</button>
      <span className="w-8 text-center font-bold">{ep}</span>
      <button onClick={() => update(ep + 1)} className="nb-btn nb-btn-accent h-8 min-h-0 w-8 p-0" data-card-accent="progress">+</button>
    </div>
  );
}
