"use client";
import { useEffect, useState } from "react";
import { Sparkles, FastForward, Wand2, ArrowUp } from "lucide-react";
import { useAi } from "@/lib/ai/useAi";
import { getSpoilerCeiling } from "@/lib/storage/store";
import type { Anime } from "@/lib/anime/types";
import { AiReport } from "@/components/ui/AiReport";

export function AiPanel({ anime }: { anime: Anime }) {
  const { text, loading, error, ask } = useAi();
  const [ceiling, setCeiling] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => setCeiling(getSpoilerCeiling(anime.id)), [anime.id]);

  useEffect(() => {
    function refresh() {
      setCeiling(getSpoilerCeiling(anime.id));
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [anime.id]);

  async function askFresh(args: Omit<Parameters<typeof ask>[0], "ceiling">) {
    const freshCeiling = getSpoilerCeiling(anime.id);
    setCeiling(freshCeiling);
    await ask({ ...args, ceiling: freshCeiling });
    setCeiling(getSpoilerCeiling(anime.id));
  }

  const base = { animeTitle: anime.title, context: anime.description ?? undefined };
  return (
    <section data-card-accent="ai" className="nb-card-accent mt-6 bg-ink-800 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="nb-tag flex h-8 w-8 shrink-0 items-center justify-center p-0">
            <Sparkles size={16} />
          </span>
          <h2 className="nb-heading nb-heading-md">AI Companion</h2>
        </div>
        <span className="nb-tag text-white/60">
          spoiler-safe to ep {ceiling}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => askFresh({ ...base, task: "summary" })}
          className="nb-btn"
        >
          <Sparkles size={18} /> AI Summary
        </button>
        <button
          onClick={() => askFresh({ ...base, task: "catchup" })}
          className="nb-btn"
        >
          <FastForward size={18} /> Catch me up
        </button>
        <button
          onClick={() => askFresh({ ...base, task: "recommend" })}
          className="nb-btn"
        >
          <Wand2 size={18} /> Recommend
        </button>
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) askFresh({ ...base, task: "chat", question: q });
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything (spoiler-safe)…"
          className="nb-input flex-1"
        />
        <button
          type="submit"
          aria-label="Send"
          className="nb-btn-accent nb-btn shrink-0 px-3"
        >
          <ArrowUp size={20} />
        </button>
      </form>

      {loading && (
        <div className="mt-3 flex items-center gap-1.5 px-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-accent-purple [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-accent-purple [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-accent-purple" />
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-bold text-accent-crimson">AI is temporarily unavailable. Please try again.</p>
      )}

      {text && (
        <div className="nb-border-thick mt-4 border-t pt-4">
          <AiReport text={text} />
        </div>
      )}
    </section>
  );
}
