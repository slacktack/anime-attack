"use client";
import { useQuery } from "@tanstack/react-query";
import { getRandomQuote } from "@/lib/anime/quotes";

export function QuoteWidget() {
  const { data, isLoading } = useQuery({ queryKey: ["quote"], queryFn: getRandomQuote });

  if (isLoading || !data) return null;

  return (
    <div className="mx-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <p className="text-lg italic leading-relaxed text-white/90 sm:text-xl">&ldquo;{data.quote}&rdquo;</p>
      <p className="mt-3 text-sm font-semibold text-accent-gold">
        — {data.character}, {data.anime}
      </p>
    </div>
  );
}
