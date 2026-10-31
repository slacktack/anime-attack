"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Loader2,
  Play,
  Search,
} from "lucide-react";
import type { MangaChapter, MangaDetail } from "@/lib/manga/types";

const rowClass =
  "glass flex min-h-[62px] items-center justify-between gap-3 rounded-2xl p-3 transition-colors hover:bg-white/[0.07]";

function ChapterRow({ chapter }: { chapter: MangaChapter }) {
  const badge = chapter.chapter
    ? `CH ${chapter.chapter}`
    : chapter.volume
      ? `VOL ${chapter.volume}`
      : "READ";

  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 min-w-14 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] px-2 text-[11px] font-bold text-white/80">
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-white/90">
            {chapter.title || `Chapter ${chapter.chapter ?? "—"}`}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            {chapter.pages > 0 ? `${chapter.pages} pages` : "Official release"}
            {chapter.group ? ` · ${chapter.group}` : ""}
          </p>
        </div>
      </div>
      {chapter.externalUrl ? (
        <ExternalLink size={16} className="shrink-0 text-sky-300/70" />
      ) : (
        <ChevronRight size={18} className="shrink-0 text-white/35" />
      )}
    </>
  );

  if (chapter.externalUrl) {
    return (
      <a
        href={chapter.externalUrl}
        target="_blank"
        rel="noreferrer noopener"
        className={rowClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={`/read/${chapter.id}`} className={rowClass} prefetch={false}>
      {inner}
    </Link>
  );
}

export function MangaDetailView({ id }: { id: string }) {
  const [term, setTerm] = useState("");
  const [ascending, setAscending] = useState(false);
  const [visible, setVisible] = useState(60);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["manga-detail", id],
    queryFn: async (): Promise<MangaDetail> => {
      const res = await fetch(`/api/manga/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Couldn't load this manga");
      return json as MangaDetail;
    },
    staleTime: 300_000,
  });

  const chapters = useMemo(() => {
    if (!data) return [];
    const search = term.trim().toLowerCase();
    const list = search
      ? data.chapters.filter((chapter) => {
          if ((chapter.chapter ?? "").includes(search)) return true;
          return (chapter.title ?? "").toLowerCase().includes(search);
        })
      : data.chapters;
    return ascending ? [...list].reverse() : list;
  }, [data, term, ascending]);

  const hosted = useMemo(
    () => (data?.chapters ?? []).filter((chapter) => chapter.pages > 0 && !chapter.externalUrl),
    [data],
  );
  const official = useMemo(
    () => (data?.chapters ?? []).filter((chapter) => !!chapter.externalUrl),
    [data],
  );
  const firstReadable = hosted[hosted.length - 1] ?? null;
  const firstOfficial = official[official.length - 1] ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="h-10 w-24 animate-pulse rounded-xl bg-ink-800" />
        <div className="h-64 animate-pulse rounded-2xl bg-ink-800" />
        <div className="h-11 animate-pulse rounded-xl bg-ink-800" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-ink-800" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-8">
        <Link href="/manga" className="nb-btn mb-5">
          <ArrowLeft size={16} /> Manga
        </Link>
        <div className="nb-card p-5">
          <p className="text-sm font-bold">Couldn&apos;t open this manga</p>
          <p className="mt-1 text-xs text-white/50">
            {error instanceof Error ? error.message : "Try again in a moment."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/manga" className="nb-btn">
          <ArrowLeft size={16} /> Manga
        </Link>
        <span className="nb-tag">{data.status ?? "manga"}</span>
      </div>

      <section className="nb-card p-4">
        <div className="flex gap-4">
          {data.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.cover}
              alt={data.title}
              className="h-48 w-32 shrink-0 rounded-2xl object-cover shadow-2xl shadow-black/50 sm:h-60 sm:w-40"
            />
          ) : (
            <div className="flex h-48 w-32 shrink-0 items-center justify-center rounded-2xl bg-ink-700 sm:h-60 sm:w-40">
              <BookOpen size={30} className="text-white/30" />
            </div>
          )}
          <div className="flex min-w-0 flex-col justify-end gap-2">
            <h1 className="nb-heading text-2xl leading-[1.05] sm:text-4xl">{data.title}</h1>
            <p className="line-clamp-2 text-xs font-medium text-white/50">
              {[...data.authors, ...data.artists].filter((v, i, arr) => arr.indexOf(v) === i).join(" · ") ||
                "Unknown author"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.year && <span className="nb-tag">{data.year}</span>}
              {data.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="nb-tag">
                  {tag}
                </span>
              ))}
            </div>
            {firstReadable ? (
              <Link
                href={`/read/${firstReadable.id}`}
                className="nb-btn nb-btn-accent mt-1 w-fit"
                prefetch={false}
              >
                <Play size={14} fill="currentColor" /> Start reading
              </Link>
            ) : firstOfficial?.externalUrl ? (
              <a
                href={firstOfficial.externalUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="nb-btn nb-btn-accent mt-1 w-fit"
              >
                <ExternalLink size={14} /> Read officially
              </a>
            ) : null}
          </div>
        </div>

        {data.description && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-white/45">
              Synopsis
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/65">
              {data.description}
            </p>
          </details>
        )}

        <a
          href={`https://mangadex.org/title/${data.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/60"
        >
          <ExternalLink size={11} /> View on MangaDex
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="nb-section-header mb-0">
            Chapters
            <span className="text-xs font-semibold tracking-normal text-white/35">
              {data.chapters.length > 0 ? `${data.chapters.length} total` : ""}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setAscending((value) => !value)}
            className="nb-btn min-h-10 px-3 text-xs"
          >
            <ArrowUpDown size={13} /> {ascending ? "Oldest" : "Newest"}
          </button>
        </div>

        {hosted.length === 0 && official.length > 0 && (
          <div className="nb-card p-4">
            <p className="text-sm font-semibold">English pages live on the official site</p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              MangaDex only indexes external links for this title. Tap any chapter below to continue
              on the publisher — free on Webnovel / Tappytoon.
            </p>
          </div>
        )}

        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setVisible(60);
            }}
            placeholder="Jump to chapter…"
            inputMode="search"
            className="nb-input pl-11"
          />
        </div>

        {!data.chapters.length ? (
          <div className="nb-card p-5 text-center">
            <p className="text-sm font-bold">No readable chapters here</p>
            <p className="mt-1 text-xs text-white/50">
              This title may be licensed. Try another edition or read it on MangaDex.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {chapters.slice(0, visible).map((chapter) => (
                <ChapterRow key={chapter.id} chapter={chapter} />
              ))}
            </div>
            {chapters.length > visible && (
              <button
                type="button"
                onClick={() => setVisible((value) => value + 100)}
                className="nb-btn w-full"
              >
                <Loader2 size={14} /> Load {Math.min(100, chapters.length - visible)} more
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
