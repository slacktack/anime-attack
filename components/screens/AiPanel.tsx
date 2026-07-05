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
    <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 shadow-xl shadow-black/30 ring-1 ring-accent-purple/20 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-accent-purple/30 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-purple to-accent-blue text-sm shadow-lg shadow-accent-purple/30">
            <Sparkles size={18} color="currentColor" />
          </span>
          <h2 className="text-lg font-bold">AI Companion</h2>
        </div>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/40">
          spoiler-safe to ep {ceiling}
        </span>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => askFresh({ ...base, task: "summary" })}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10"
        >
          <Sparkles size={18} color="currentColor" /> AI Summary
        </button>
        <button
          onClick={() => askFresh({ ...base, task: "catchup" })}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10"
        >
          <FastForward size={18} color="currentColor" /> Catch me up
        </button>
        <button
          onClick={() => askFresh({ ...base, task: "recommend" })}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-white/10"
        >
          <Wand2 size={18} color="currentColor" /> Recommend
        </button>
      </div>

      <form
        className="relative mt-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] p-1.5 pl-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) askFresh({ ...base, task: "chat", question: q });
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything (spoiler-safe)…"
          className="min-h-11 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/35"
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-blue text-lg font-semibold shadow-lg shadow-accent-purple/30 transition-transform active:scale-95"
        >
          <ArrowUp size={20} color="currentColor" />
        </button>
      </form>

      {loading && (
        <div className="relative mt-3 flex items-center gap-1.5 px-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" />
        </div>
      )}
      {error && (
        <p className="relative mt-3 text-sm text-accent-crimson">AI is temporarily unavailable. Please try again.</p>
      )}
      {text && (
        <div className="relative mt-3">
          <AiReport text={text} />
        </div>
      )}
    </section>
  );
}
