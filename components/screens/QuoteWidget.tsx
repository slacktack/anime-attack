"use client";
import { useQuery } from "@tanstack/react-query";
import { getRandomQuote } from "@/lib/anime/quotes";

export function QuoteWidget() {
  const { data, isLoading } = useQuery({ queryKey: ["quote"], queryFn: getRandomQuote });

  if (isLoading || !data) return null;

  return (
    <div className="mx-4 nb-card-accent bg-ink-800 p-5" data-card-accent="quote">
      <p className="font-display text-lg italic font-medium leading-relaxed text-white/90 sm:text-xl">&ldquo;{data.quote}&rdquo;</p>
      <p className="nb-heading-sm mt-3 text-accent-gold">
        — {data.character}, {data.anime}
      </p>
    </div>
  );
}
