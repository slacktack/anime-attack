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
    <div className="flex items-center gap-3 rounded-2xl bg-ink-800 px-4 py-3">
      <span className="text-sm text-white/60">I&apos;m on episode</span>
      <button onClick={() => update(ep - 1)} className="h-8 w-8 rounded-full bg-white/10">−</button>
      <span className="w-8 text-center font-bold">{ep}</span>
      <button onClick={() => update(ep + 1)} className="h-8 w-8 rounded-full bg-accent-purple">+</button>
    </div>
  );
}
