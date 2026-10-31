"use client";
import { useEffect, useState } from "react";
import { Gauge, Minus, Plus } from "lucide-react";
import { getSpoilerCeiling, setSpoilerCeiling, recordProgress } from "@/lib/storage/store";
import type { AnimeSummary } from "@/lib/anime/types";

/**
 * Episode progress / spoiler ceiling control.
 * The stored value also gates what the AI panel is allowed to discuss.
 */
export function ProgressControl({
  anime,
  maxEpisodes,
}: {
  anime: AnimeSummary;
  maxEpisodes: number | null;
}) {
  const [ep, setEp] = useState(0);
  useEffect(() => setEp(getSpoilerCeiling(anime.id)), [anime.id]);

  function update(next: number) {
    const clamped = Math.max(0, maxEpisodes ? Math.min(next, maxEpisodes) : next);
    setEp(clamped);
    setSpoilerCeiling(anime.id, clamped);
    recordProgress(anime, clamped);
  }

  const total = maxEpisodes ?? null;
  const pct = total && total > 0 ? Math.min(100, Math.round((ep / total) * 100)) : 0;

  return (
    <section className="nb-card p-4" data-card-accent="progress">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-display text-[15px] font-bold">
          <Gauge size={15} className="text-accent-purple" />
          Your progress
        </span>
        <span className="text-[11px] font-semibold text-white/40">
          {total ? `${pct}% of ${total}` : "Not tracked"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => update(ep - 1)}
          disabled={ep <= 0}
          aria-label="Previous episode"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06] transition-colors hover:bg-white/[0.1] disabled:opacity-35"
        >
          <Minus size={17} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="font-display text-xl font-bold leading-none">
            {ep}
            <span className="text-[12px] font-semibold text-white/35"> / {total ?? "—"}</span>
          </span>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, var(--accent-purple), var(--accent-blue))",
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => update(ep + 1)}
          disabled={total != null && ep >= total}
          aria-label="Next episode"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white transition-transform active:scale-95 disabled:opacity-35"
          style={{
            background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
          }}
        >
          <Plus size={17} />
        </button>
      </div>

      <p className="mt-2.5 text-[11px] leading-snug text-white/35">
        Set how far you have watched — the AI recap never spoils past this episode.
      </p>
    </section>
  );
}
