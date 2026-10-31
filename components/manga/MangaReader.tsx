"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  RotateCw,
  Sparkles,
} from "lucide-react";
import type { MangaReaderData } from "@/lib/manga/types";

type Quality = "high" | "low";

/** A single page image that retries itself instead of leaving a blank hole. */
function PageImage({
  src,
  index,
  eager,
  onMount,
}: {
  src: string;
  index: number;
  eager: boolean;
  onMount: (element: HTMLImageElement | null) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const resolved = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;

  const retry = useCallback(() => {
    setFailed(false);
    setLoaded(false);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="relative w-full max-w-[900px]">
      {!loaded && !failed && (
        <div className="absolute inset-0 grid min-h-[220px] place-items-center bg-ink-900">
          <Loader2 size={20} className="animate-spin text-white/30" />
        </div>
      )}

      {failed ? (
        <div className="grid min-h-[220px] place-items-center gap-2 rounded-xl border border-white/10 bg-ink-900 px-4 py-8 text-center">
          <p className="text-[12.5px] font-bold text-white/70">Page {index + 1} did not load</p>
          <button type="button" onClick={retry} className="nb-btn mx-auto">
            <RotateCw size={14} /> Retry page
          </button>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={onMount}
          src={resolved}
          alt={`Page ${index + 1}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (attempt >= 2) setFailed(true);
            else setAttempt((n) => n + 1);
          }}
          className={`block w-full select-none transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

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
      <div className="px-4 py-4">
        <div className="skeleton mb-4 h-12 w-full rounded-2xl" />
        <div className="flex flex-col items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] w-full max-w-[900px]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-8">
        <Link href="/manga" className="nb-btn mb-4">
          <ArrowLeft size={16} /> Manga
        </Link>
        <div className="nb-card p-5 text-center">
          <p className="font-display text-[15px] font-bold">This chapter won&apos;t open</p>
          <p className="mt-1 text-[12.5px] text-white/50">
            {error instanceof Error ? error.message : "The pages may have been removed."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 pb-24">
      <div className="app-dock sticky top-1 z-40 mx-2 rounded-2xl">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <Link
            href={`/manga/${data.mangaId}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06]"
            aria-label="Back to manga"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 font-display text-[12px] font-bold">{data.mangaTitle}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
              Ch. {data.chapter ?? "—"}
              {data.title ? ` · ${data.title}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => changeQuality(quality === "high" ? "low" : "high")}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] px-2.5 text-[10px] font-black uppercase tracking-wide"
            aria-pressed={quality === "low"}
          >
            {quality === "high" ? <Sparkles size={13} /> : <Gauge size={13} />}
            {quality === "high" ? "HD" : "Lite"}
          </button>
        </div>
        <div className="mx-2.5 mb-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{
              width: `${pages.length ? (current / pages.length) * 100 : 0}%`,
              background: "linear-gradient(90deg, var(--accent-purple), var(--accent-blue))",
            }}
          />
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-display text-[14px] font-bold">No pages available</p>
          <p className="mt-1 text-[12px] text-white/50">Try a different chapter or quality.</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col items-center gap-0.5 bg-black">
          {pages.map((src, index) => (
            <PageImage
              key={`${quality}-${index}`}
              src={src}
              index={index}
              eager={index < 3}
              onMount={(element) => {
                imageRefs.current[index] = element;
              }}
            />
          ))}
        </div>
      )}

      <div className="px-4 pt-5">
        <div className="nb-card p-4 text-center">
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

      <div className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="app-dock mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-2xl px-2.5 py-2">
          {data.prev ? (
            <Link href={`/read/${data.prev.id}`} className="nb-btn min-h-11 flex-1 justify-center">
              <ChevronLeft size={16} /> Prev
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="nb-btn min-h-11 flex-1 justify-center opacity-40"
            >
              <ChevronLeft size={16} /> Prev
            </button>
          )}
          <span className="flex min-w-16 items-center justify-center gap-1 text-[11px] font-black tabular-nums">
            {current}
            <span className="text-white/30">/</span>
            {pages.length}
          </span>
          {data.next ? (
            <Link href={`/read/${data.next.id}`} className="nb-btn min-h-11 flex-1 justify-center">
              Next <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="nb-btn min-h-11 flex-1 justify-center opacity-40"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
