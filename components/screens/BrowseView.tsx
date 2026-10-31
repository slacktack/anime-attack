"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Compass, RotateCcw } from "lucide-react";
import { fetchBrowse } from "@/lib/client/api";
import { getGenreCollection } from "@/lib/anime/anilist-extra";
import { PosterCard } from "@/components/ui/PosterCard";

const FORMATS = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];
const STATUSES = ["RELEASING", "FINISHED", "NOT_YET_RELEASED"];
const SORTS = [
  { value: "POPULARITY_DESC", label: "Most popular" },
  { value: "SCORE_DESC", label: "Top rated" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "START_DATE_DESC", label: "Newest" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-all active:scale-95 ${
        active
          ? "border-transparent bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white shadow-[0_10px_24px_-14px_rgba(139,92,246,0.9)]"
          : "border-white/12 bg-white/[0.05] text-white/60 hover:bg-white/[0.09]"
      }`}
    >
      {children}
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton aspect-[2/3] w-full" />
      ))}
    </div>
  );
}

export function BrowseView() {
  const [genre, setGenre] = useState<string | undefined>(undefined);
  const [format, setFormat] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<string>("POPULARITY_DESC");
  const [year, setYear] = useState<number | undefined>(undefined);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const list: number[] = [];
    for (let y = current + 1; y >= 1960; y--) list.push(y);
    return list;
  }, []);

  const { data: genres } = useQuery({ queryKey: ["genres"], queryFn: getGenreCollection });

  const filters = { genre, year, format, status, sort };
  const { data, isFetching } = useQuery({
    queryKey: ["browse", filters],
    queryFn: () => fetchBrowse(filters),
  });

  const dirty = Boolean(genre || format || status || year) || sort !== "POPULARITY_DESC";

  function reset() {
    setGenre(undefined);
    setFormat(undefined);
    setStatus(undefined);
    setYear(undefined);
    setSort("POPULARITY_DESC");
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight">
          <Compass size={22} className="text-accent-purple" />
          Browse
        </h1>
        <p className="mt-0.5 text-[12.5px] font-semibold text-white/40">
          Filter the whole catalogue by genre, year, format and status.
        </p>
      </header>

      <section className="nb-card flex flex-col gap-2.5 p-3">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <Chip active={genre === undefined} onClick={() => setGenre(undefined)}>
            All genres
          </Chip>
          {genres?.map((g) => (
            <Chip key={g} active={genre === g} onClick={() => setGenre(genre === g ? undefined : g)}>
              {g}
            </Chip>
          ))}
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {FORMATS.map((f) => (
            <Chip key={f} active={format === f} onClick={() => setFormat(format === f ? undefined : f)}>
              {f}
            </Chip>
          ))}
          {STATUSES.map((s) => (
            <Chip
              key={s}
              active={status === s}
              onClick={() => setStatus(status === s ? undefined : s)}
            >
              {s.replace(/_/g, " ").toLowerCase()}
            </Chip>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort by"
            className="nb-input flex-1"
            style={{ minHeight: 46 }}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={year ?? ""}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
            aria-label="Release year"
            className="nb-input flex-1"
            style={{ minHeight: 46 }}
          >
            <option value="">Any year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {dirty && (
            <button
              type="button"
              onClick={reset}
              aria-label="Reset filters"
              className="grid w-[46px] shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06] text-white/70"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold text-white/40">
          {isFetching ? "Loading…" : `${data?.length ?? 0} titles`}
        </p>
      </div>

      {isFetching && !data ? (
        <GridSkeleton />
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </div>
      ) : (
        <div className="nb-card p-6 text-center">
          <p className="font-display text-[14px] font-bold">Nothing matches those filters</p>
          <button type="button" onClick={reset} className="nb-btn mx-auto mt-3">
            <RotateCcw size={14} /> Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
