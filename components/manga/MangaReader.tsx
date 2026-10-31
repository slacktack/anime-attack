"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Sparkles,
} from "lucide-react";
import type { MangaReaderData } from "@/lib/manga/types";

type Quality = "high" | "low";

export function MangaReader({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [quality, setQuality] = useState<Quality>("high");
  const [current, setCurrent] = useState(1);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ac:reader-quality");
      if (stored === "low" || stored === "high") setQuality(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const changeQuality = (next: Quality) => {
    setQuality(next);
    try {
      window.localStorage.setItem("ac:reader-quality", next);
    } catch {
      /* ignore */
    }
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reader", chapterId],
    queryFn: async (): Promise<MangaReaderData> => {
      const res = await fetch(`/api/manga/chapter/${chapterId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Couldn't load this chapter");
      return json as MangaReaderData;
    },
    staleTime: 300_000,
    gcTime: 900_000,
  });

  const pages = useMemo(() => {
    if (!data) return [];
    const high = data.pages ?? [];
    const low = data.saverPages ?? [];
    return quality === "low" && low.length > 0 ? low : high;
  }, [data, quality]);

  useEffect(() => {
    if (pages.length === 0) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const line = window.innerHeight * 0.35;
        let index = 0;
        for (let i = 0; i < imageRefs.current.length; i += 1) {
          const element = imageRefs.current[i];
          if (!element) continue;
          if (element.getBoundingClientRect().top <= line) index = i + 1;
        }
        setCurrent(Math.min(pages.length, Math.max(1, index)));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [pages.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && data?.next) router.push(`/read/${data.next.id}`);
      if (event.key === "ArrowLeft" && data?.prev) router.push(`/read/${data.prev.id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, router]);

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <div className="mb-4 h-9 w-28 animate-pulse rounded-xl bg-ink-800" />
        <div className="flex flex-col items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full max-w-[900px] animate-pulse bg-ink-800" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-10">
        <Link href="/manga" className="nb-btn mb-5">
          <ArrowLeft size={16} /> Manga
        </Link>
        <div className="nb-card bg-ink-800 p-5">
          <p className="text-sm font-bold">This chapter won&apos;t open</p>
          <p className="mt-1 text-xs text-white/50">
            {error instanceof Error ? error.message : "The pages may have been removed."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 pb-24">
      <div className="sticky top-0 z-40 border-b-2 border-nb-border bg-ink-solid/90 backdrop-blur-md">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link
            href={`/manga/${data.mangaId}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-nb-border bg-ink-800"
            aria-label="Back to manga"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-xs font-black uppercase tracking-wide text-white/90">
              {data.mangaTitle}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Chapter {data.chapter ?? "—"}
              {data.title ? ` · ${data.title}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => changeQuality(quality === "high" ? "low" : "high")}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 border-nb-border bg-ink-800 px-3 text-[10px] font-black uppercase tracking-wide"
            aria-pressed={quality === "low"}
          >
            {quality === "high" ? <Sparkles size={13} /> : <Gauge size={13} />}
            {quality === "high" ? "HD" : "Lite"}
          </button>
        </div>
        <div className="h-1 w-full bg-ink-700">
          <div
            className="h-full bg-accent-library transition-[width] duration-150"
            style={{ width: `${pages.length ? (current / pages.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-bold">No pages available</p>
          <p className="mt-1 text-xs text-white/50">Try a different chapter or quality.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center bg-black">
          {pages.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${quality}-${index}`}
              ref={(element) => {
                imageRefs.current[index] = element;
              }}
              src={src}
              alt={`Page ${index + 1}`}
              loading={index < 3 ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              className="block w-full max-w-[900px] select-none"
            />
          ))}
        </div>
      )}

      <div className="px-4 pt-6">
        <div className="nb-card bg-ink-800 p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            End of chapter {data.chapter ?? ""}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            {data.prev && (
              <Link href={`/read/${data.prev.id}`} className="nb-btn flex-1 justify-center">
                <ChevronLeft size={16} /> Prev
              </Link>
            )}
            {data.next ? (
              <Link
                href={`/read/${data.next.id}`}
                className="nb-btn nb-btn-accent flex-1 justify-center"
              >
                Next <ChevronRight size={16} />
              </Link>
            ) : (
              <Link href={`/manga/${data.mangaId}`} className="nb-btn flex-1 justify-center">
                <ArrowLeft size={16} /> All chapters
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-nb-border bg-ink-800/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          {data.prev ? (
            <Link href={`/read/${data.prev.id}`} className="nb-btn flex-1 justify-center min-h-11">
              <ChevronLeft size={16} /> Prev
            </Link>
          ) : (
            <button type="button" disabled className="nb-btn flex-1 justify-center min-h-11 opacity-40">
              <ChevronLeft size={16} /> Prev
            </button>
          )}
          <span className="flex min-w-20 items-center justify-center gap-1 text-[11px] font-black tabular-nums">
            {current}
            <span className="text-white/30">/</span>
            {pages.length}
          </span>
          {data.next ? (
            <Link href={`/read/${data.next.id}`} className="nb-btn flex-1 justify-center min-h-11">
              Next <ChevronRight size={16} />
            </Link>
          ) : (
            <button type="button" disabled className="nb-btn flex-1 justify-center min-h-11 opacity-40">
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
