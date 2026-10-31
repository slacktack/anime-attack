"use client";
import { useQuery } from "@tanstack/react-query";
import { getRandomQuote } from "@/lib/anime/quotes";

export function QuoteWidget() {
  const { data, isLoading } = useQuery({ queryKey: ["quote"], queryFn: getRandomQuote });
  if (isLoading || !data) return null;

  return (
    <figure className="mx-auto max-w-3xl border-t border-[var(--glass-border)] pt-10 text-center">
      <blockquote className="font-display text-[22px] font-semibold leading-snug tracking-[-0.02em] text-white/90 sm:text-[28px]">
        &ldquo;{data.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-4 text-[14px] text-muted">
        {data.character}, <span className="italic">{data.anime}</span>
      </figcaption>
    </figure>
  );
}
