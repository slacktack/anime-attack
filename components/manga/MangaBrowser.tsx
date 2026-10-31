"use client";
import { PageHeader } from "@/components/ui/PageHeader";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, ChevronRight, Flame, Loader2, Search, Sparkles } from "lucide-react";
import type { MangaList } from "@/lib/manga/mangadex";
import type { MangaCard } from "@/lib/manga/types";
import { useDebounce } from "@/lib/ui/useDebounce";

function MangaCardView({ manga }: { manga: MangaCard }) {
  return (
    <Link href={`/manga/${manga.id}`} className="group block min-w-0">
      <div className="poster-frame aspect-[2/3] ring-1 ring-inset ring-white/[0.06]">
        {manga.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={manga.cover} alt={manga.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center p-3 text-center font-display text-[15px] font-bold text-white/40">
            {manga.title}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90 group-hover:text-white">{manga.title}</p>
      <p className="mt-0.5 text-[12px] capitalize text-muted">
        {[manga.latestChapter ? `Ch. ${manga.latestChapter}` : null, manga.status].filter(Boolean).join("  /  ")}
      </p>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div className="aa-grid">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton aspect-[2/3] w-full" />
          <div className="skeleton h-3 w-4/5 rounded" />
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
      <PageHeader title="Manga" subtitle="Read the source material, chapter by chapter." />

      <div className="relative max-w-2xl">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
        />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search any manga, manhwa or manhua"
          inputMode="search"
          className="nb-input pl-11"
        />
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setOrder("popular")}
          aria-pressed={order === "popular"}
          className="aa-pill"
          data-active={order === "popular"}
        >
          <Flame size={13} /> Popular
        </button>
        <button
          type="button"
          onClick={() => setOrder("latest")}
          aria-pressed={order === "latest"}
          className="aa-pill"
          data-active={order === "latest"}
        >
          <Sparkles size={13} /> Latest
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
          <div className="aa-grid">
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
