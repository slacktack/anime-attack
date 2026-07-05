"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, Sparkles, Lightbulb, HelpCircle } from "lucide-react";
import { getCharacterFull } from "@/lib/anime/anilist-extra";
import { useAi } from "@/lib/ai/useAi";
import { htmlToText } from "@/lib/ui/htmlToText";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { Carousel } from "@/components/ui/Carousel";
import { PosterCard } from "@/components/ui/PosterCard";
import { AiReport } from "@/components/ui/AiReport";

const DESCRIPTION_CLAMP = 400;

export function CharacterDetail({ id }: { id: number }) {
  const { data: character, isLoading } = useQuery({
    queryKey: ["character", id],
    queryFn: () => getCharacterFull(id),
  });
  const { text, loading, error, ask } = useAi();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !character) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="animate-pulse text-sm text-white/40">Loading character…</p>
      </div>
    );
  }

  const animeTitle = character.media[0]?.title ?? "this series";
  const description = htmlToText(character.description);
  const isLong = description.length > DESCRIPTION_CLAMP;
  const shownDescription = !isLong || expanded ? description : `${description.slice(0, DESCRIPTION_CLAMP)}…`;

  function askFresh(args: Omit<Parameters<typeof ask>[0], "ceiling" | "animeTitle" | "characterName">) {
    if (!character) return;
    return ask({ ...args, animeTitle, characterName: character.name, ceiling: 0 });
  }

  return (
    <div className="relative pb-10">
      <HeroBackdrop tint="#7C3AED" />
      <div className="px-4 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          {character.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.image}
              alt={character.name}
              className="w-40 shrink-0 rounded-2xl object-cover shadow-lg shadow-black/40 sm:w-56"
            />
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{character.name}</h1>
            {character.native && <p className="mt-1 text-sm text-white/50">{character.native}</p>}
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {character.gender && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{character.gender}</span>
              )}
              {character.age && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">Age: {character.age}</span>
              )}
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-accent-crimson">
                <Heart size={14} color="currentColor" fill="currentColor" /> {character.favourites}
              </span>
            </div>
          </div>
        </div>

        {description && (
          <div className="mt-6">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{shownDescription}</p>
            {isLong && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 min-h-11 text-sm font-semibold text-accent-purple"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}
      </div>

      {character.media.length > 0 && (
        <div className="mt-8">
          <Carousel title="Appears in">
            {character.media.map((anime) => (
              <PosterCard key={anime.id} anime={anime} />
            ))}
          </Carousel>
        </div>
      )}

      <section className="mx-4 mt-6 rounded-3xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-transparent p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-lg font-bold">
          <Sparkles size={18} color="currentColor" /> AI Companion{" "}
          <span className="text-xs font-normal text-white/40">(spoiler-safe)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => askFresh({ task: "character" })}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm"
          >
            <Sparkles size={16} color="currentColor" /> Summary
          </button>
          <button
            onClick={() => askFresh({ task: "charfacts" })}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm"
          >
            <Lightbulb size={16} color="currentColor" /> Fun facts
          </button>
          <button
            onClick={() => askFresh({ task: "charquiz" })}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm"
          >
            <HelpCircle size={16} color="currentColor" /> Quiz
          </button>
        </div>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) askFresh({ task: "chat", question: q });
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask anything about this character…"
            className="min-h-11 flex-1 rounded-full border border-white/10 bg-ink-800 px-4 py-2.5 text-base outline-none focus:border-accent-purple"
          />
          <button className="min-h-11 rounded-full bg-accent-purple px-4 py-2.5 text-sm font-semibold">Ask</button>
        </form>
        {loading && <p className="mt-3 animate-pulse text-sm text-white/40">Thinking…</p>}
        {error && <p className="mt-3 text-sm text-accent-crimson">AI is temporarily unavailable. Please try again.</p>}
        {text && (
          <div className="mt-3">
            <AiReport text={text} />
          </div>
        )}
      </section>
    </div>
  );
}
