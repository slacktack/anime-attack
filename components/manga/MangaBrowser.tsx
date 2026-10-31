"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, ChevronRight, Flame, Loader2, Search, Sparkles } from "lucide-react";
import type { MangaList } from "@/lib/manga/mangadex";
import type { MangaCard } from "@/lib/manga/types";
import { useDebounce } from "@/lib/ui/useDebounce";

function MangaCardView({ manga }: { manga: MangaCard }) {
  return (
    <Link
      href={`/manga/${manga.id}`}
      className="group flex min-w-0 flex-col gap-2"
      prefetch={false}
    >
      <div className="nb-border-thick nb-shadow relative overflow-hidden rounded-xl bg-ink-800">
        {manga.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={manga.cover}
            alt={manga.title}
            loading="lazy"
            decoding="async"
            className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-active:scale-[0.98]"
          />
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center bg-ink-700">
            <BookOpen size={28} className="text-white/30" />
          </div>
        )}
        {manga.latestChapter && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md border border-nb-border/60 bg-ink-solid/85 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide backdrop-blur-sm">
            Ch. {manga.latestChapter}
          </span>
        )}
        <span className="absolute right-1.5 top-1.5 rounded-md bg-accent-purple px-1.5 py-0.5 text-[9px] font-black uppercase text-black">
          {manga.status ?? "manga"}
        </span>
      </div>
      <p className="line-clamp-2 text-xs font-bold leading-snug text-white/90">{manga.title}</p>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="aspect-[2/3] w-full animate-pulse rounded-xl border-2 border-nb-border/20 bg-ink-800" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-ink-700" />
        </div>
      ))}
    </div>
  );
}

export function MangaBrowser() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState<"popular" | "latest">("popular");
  const query = useDebounce(term, 350);

  useEffect(() => {
    setPage(0);
  }, [query, order]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["manga-list", query, page, order],
    queryFn: async (): Promise<MangaList> => {
      const params = new URLSearchParams({ page: String(page), order });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/manga/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Couldn't load manga");
      return json as MangaList;
    },
    staleTime: 300_000,
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <span className="nb-tag w-fit text-accent-purple">
          <BookOpen size={12} className="mr-1.5" /> Manga
        </span>
        <h1 className="nb-heading nb-heading-xl font-black leading-none">Read the source.</h1>
        <p className="text-sm text-white/55">
          Thousands of titles, chapter by chapter. No ads, no redirects, just pages.
        </p>
      </header>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
        />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search any manga…"
          inputMode="search"
          className="nb-input pl-11"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          type="button"
          onClick={() => setOrder("popular")}
          className={`nb-btn shrink-0 ${order === "popular" ? "nb-btn-accent" : ""}`}
        >
          <Flame size={15} /> Popular
        </button>
        <button
          type="button"
          onClick={() => setOrder("latest")}
          className={`nb-btn shrink-0 ${order === "latest" ? "nb-btn-accent" : ""}`}
        >
          <Sparkles size={15} /> Latest
        </button>
      </div>

      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <div className="nb-card bg-ink-800 p-5">
          <p className="text-sm font-bold">Couldn&apos;t reach the manga shelf</p>
          <p className="mt-1 text-xs text-white/50">
            {error instanceof Error ? error.message : "Try again in a moment."}
          </p>
        </div>
      ) : !data?.items.length ? (
        <div className="nb-card bg-ink-800 p-6 text-center">
          <p className="text-sm font-bold">Nothing matched “{query}”</p>
          <p className="mt-1 text-xs text-white/50">Try a shorter title or a different spelling.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {data.items.map((manga) => (
              <MangaCardView key={manga.id} manga={manga} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pb-2">
            <button
              type="button"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className="nb-btn disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-white/45">
              {isFetching ? (
                <Loader2 size={14} className="inline animate-spin" />
              ) : (
                `Page ${page + 1} / ${totalPages}`
              )}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages || isFetching}
              onClick={() => setPage((value) => value + 1)}
              className="nb-btn disabled:opacity-40"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      <p className="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30">
        Library powered by MangaDex
      </p>
    </div>
  );
}
