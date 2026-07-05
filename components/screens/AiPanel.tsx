"use client";
import { useEffect, useState } from "react";
import { useAi } from "@/lib/ai/useAi";
import { getSpoilerCeiling } from "@/lib/storage/store";
import type { Anime } from "@/lib/anime/types";

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
    <section className="mt-6 rounded-3xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-transparent p-4">
      <h2 className="mb-3 text-lg font-bold">✨ AI Companion <span className="text-xs font-normal text-white/40">(spoiler-safe to ep {ceiling})</span></h2>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => askFresh({ ...base, task: "summary" })} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">AI Summary</button>
        <button onClick={() => askFresh({ ...base, task: "catchup" })} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">Catch me up</button>
        <button onClick={() => askFresh({ ...base, task: "recommend" })} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">Recommend</button>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) askFresh({ ...base, task: "chat", question: q }); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything (spoiler-safe)…"
          className="flex-1 rounded-full border border-white/10 bg-ink-800 px-4 py-2 text-sm outline-none focus:border-accent-purple" />
        <button className="rounded-full bg-accent-purple px-4 py-2 text-sm font-semibold">Ask</button>
      </form>
      {loading && <p className="mt-3 animate-pulse text-sm text-white/40">Thinking…</p>}
      {error && <p className="mt-3 text-sm text-accent-crimson">AI is temporarily unavailable. Please try again.</p>}
      {text && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{text}</p>}
    </section>
  );
}
