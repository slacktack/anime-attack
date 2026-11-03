"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, BookOpen, Lock, Play, Search } from "lucide-react";
import { isHostedChapter as isReadable, type MangaChapter, type MangaDetail } from "@/lib/manga/types";

export function lastReadKey(mangaId: string) {
  return `ac:manga-last:${mangaId}`;
}

function relDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ChapterRow({ chapter, current }: { chapter: MangaChapter; current: boolean }) {
  const readable = isReadable(chapter);
  const label = chapter.chapter ? `Chapter ${chapter.chapter}` : chapter.volume ? `Volume ${chapter.volume}` : "One-shot";
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{label}</span>
        <span className={`line-clamp-1 block text-[12.5px] ${current ? "text-black/60" : "text-muted"}`}>
          {readable ? chapter.title || relDate(chapter.publishAt) || "Read now" : "Not available yet"}
        </span>
      </span>
      {readable ? (
        <BookOpen size={16} className="shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
      ) : (
        <Lock size={14} className="shrink-0 opacity-60" />
      )}
    </>
  );
  const cls = `group flex min-h-[60px] items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${
    current ? "bg-white text-black" : "bg-ink-800 hover:bg-ink-700"
  }`;
  if (readable) {
    return (
      <Link href={`/read/${chapter.id}`} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <span title="No source has this chapter yet" className={`${cls} cursor-default opacity-45`}>
      {body}
    </span>
  );
}

export function MangaDetailView({ id }: { id: string }) {
  const [term, setTerm] = useState("");
  const [ascending, setAscending] = useState(false);
  const [visible, setVisible] = useState(90);
  const [storyOpen, setStoryOpen] = useState(false);
  const [last, setLast] = useState<{ id: string; chapter: string | null } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(lastReadKey(id));
      setLast(raw ? JSON.parse(raw) : null);
    } catch {
      setLast(null);
    }
  }, [id]);

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

  useEffect(() => {
    if (data?.title) document.title = `${data.title} · Anime Attack`;
  }, [data?.title]);

  const readable = useMemo(() => (data?.chapters ?? []).filter(isReadable), [data]);
  const chapters = useMemo(() => {
    if (!data) return [];
    const q = term.trim().toLowerCase();
    // hide outbound-only chapters when the same run is readable here
    const base = readable.length ? data.chapters.filter(isReadable) : data.chapters;
    const list = q
      ? base.filter((c) => (c.chapter ?? "").includes(q) || (c.title ?? "").toLowerCase().includes(q))
      : base;
    return ascending ? [...list].reverse() : list;
  }, [data, term, ascending, readable.length]);

  if (isLoading) {
    return (
      <div className="pb-12">
        <div className="skeleton h-[52svh] min-h-[420px] w-full rounded-none" />
        <div className="aa-gutter mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-[60px]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="aa-gutter py-20 text-center">
        <p className="font-display text-[20px] font-bold">This manga didn&apos;t load</p>
        <p className="mt-1 text-[14px] text-muted">{error instanceof Error ? error.message : "Try again in a moment."}</p>
        <Link href="/manga" className="aa-cta mt-5">
          Back to manga
        </Link>
      </div>
    );
  }

  const first = readable[readable.length - 1] ?? null;
  const resume = last && readable.find((c) => c.id === last.id) ? last : null;
  const latest = readable[0] ?? null;
  const people = [...data.authors, ...data.artists].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="pb-16">
      <section className="on-media relative overflow-hidden bg-black">
        {data.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.cover} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl saturate-150" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--ink-solid)_0%,color-mix(in_oklab,var(--ink-solid)_60%,transparent)_45%,rgba(0,0,0,0.35)_100%)]" />
        <div className="aa-gutter relative flex flex-col gap-6 pb-8 pt-[calc(var(--header-h)+env(safe-area-inset-top)+12px)] sm:flex-row sm:items-end lg:gap-10 lg:pb-12 lg:pt-[calc(var(--header-h)+40px)]">
          <div className="poster-frame aspect-[2/3] w-[150px] shrink-0 rounded-lg shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 sm:w-[190px] lg:w-[240px]">
            {data.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.cover} alt={data.title} className="h-full w-full object-cover" />
            ) : (
              <BookOpen size={30} className="m-auto mt-[60%] text-white/30" />
            )}
          </div>
          <div className="min-w-0 max-w-3xl">
            <h1 className="aa-billboard-title text-[38px] text-white sm:text-[52px] lg:text-[clamp(52px,5vw,84px)]">{data.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-medium text-white/80">
              {data.status && <span className="font-semibold capitalize text-emerald-400">{data.status}</span>}
              {data.year && <span>{data.year}</span>}
              {readable.length > 0 && <span>{readable.length} chapters</span>}
              {people[0] && <span className="text-white/60">{people.slice(0, 2).join(", ")}</span>}
            </div>
            {data.tags.length > 0 && <p className="mt-2 text-[13.5px] text-white/65">{data.tags.slice(0, 5).join("  •  ")}</p>}
            {data.description && (
              <button type="button" onClick={() => setStoryOpen((v) => !v)} className="mt-4 block text-left">
                <span className={`block max-w-[68ch] text-[15px] leading-relaxed text-white/80 ${storyOpen ? "" : "line-clamp-3"}`}>
                  {data.description}
                </span>
              </button>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {resume ? (
                <Link href={`/read/${resume.id}`} className="aa-cta lg:min-h-[52px] lg:px-8 lg:text-[17px]">
                  <Play size={19} fill="currentColor" /> Continue chapter {resume.chapter ?? ""}
                </Link>
              ) : first ? (
                <Link href={`/read/${first.id}`} className="aa-cta lg:min-h-[52px] lg:px-8 lg:text-[17px]">
                  <Play size={19} fill="currentColor" /> Read chapter {first.chapter ?? "1"}
                </Link>
              ) : null}
              {latest && latest.id !== first?.id && latest.id !== resume?.id && (
                <Link href={`/read/${latest.id}`} className="aa-cta-ghost lg:min-h-[52px] lg:px-7 lg:text-[17px]">
                  Latest: ch. {latest.chapter}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="aa-gutter mt-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="aa-section-title mr-auto">
            Chapters
            {chapters.length > 0 && <span className="text-[13px] font-medium tracking-normal text-muted">{chapters.length}</span>}
          </h2>
          <label className="relative block w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setVisible(90);
              }}
              placeholder="Find a chapter"
              inputMode="search"
              className="nb-input pl-10"
              style={{ minHeight: 44 }}
            />
          </label>
          <button type="button" onClick={() => setAscending((v) => !v)} className="nb-btn">
            <ArrowUpDown size={15} /> {ascending ? "Oldest first" : "Newest first"}
          </button>
        </div>

        {chapters.length === 0 ? (
          <div className="py-14 text-center">
            <p className="font-display text-[20px] font-bold">{term ? "No chapter matches that" : "No English chapters yet"}</p>
            <p className="mt-1 text-[14px] text-muted">
              {term ? "Try a chapter number." : "This series hasn't been translated in any source we read from."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {chapters.slice(0, visible).map((c) => (
                <ChapterRow key={c.id} chapter={c} current={c.id === resume?.id} />
              ))}
            </div>
            {chapters.length > visible && (
              <button type="button" onClick={() => setVisible((v) => v + 150)} className="nb-btn mt-4 w-full">
                Show {Math.min(150, chapters.length - visible)} more
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
