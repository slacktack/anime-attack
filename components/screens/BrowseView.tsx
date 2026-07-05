"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { browseAnime, getGenreCollection } from "@/lib/anime/anilist-extra";
import { PosterCard } from "@/components/ui/PosterCard";

const FORMATS = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];
const STATUSES = ["RELEASING", "FINISHED", "NOT_YET_RELEASED"];
const SORTS = [
  { value: "POPULARITY_DESC", label: "Popular" },
  { value: "SCORE_DESC", label: "Top Rated" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "START_DATE_DESC", label: "Newest" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nb-btn shrink-0 whitespace-nowrap px-4 py-2 text-sm ${active ? "nb-btn-accent" : ""}`}
    >
      {children}
    </button>
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
    for (let y = current; y >= 1960; y--) list.push(y);
    return list;
  }, []);

  const { data: genres } = useQuery({ queryKey: ["genres"], queryFn: getGenreCollection });

  const filters = { genre, year, format, status, sort };
  const { data, isFetching } = useQuery({
    queryKey: ["browse", filters],
    queryFn: () => browseAnime(filters),
  });

  return (
    <div>
      <h1 className="nb-heading nb-heading-xl">Browse</h1>
      <div className="nb-section-header mt-1">Discover Anime</div>

      <div className="nb-card mt-4 space-y-3 bg-ink-800 p-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={genre === undefined} onClick={() => setGenre(undefined)}>
            All
          </Chip>
          {genres?.map((g) => (
            <Chip key={g} active={genre === g} onClick={() => setGenre(genre === g ? undefined : g)}>
              {g}
            </Chip>
          ))}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FORMATS.map((f) => (
            <Chip key={f} active={format === f} onClick={() => setFormat(format === f ? undefined : f)}>
              {f}
            </Chip>
          ))}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {STATUSES.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? undefined : s)}>
              {s.replace(/_/g, " ")}
            </Chip>
          ))}
        </div>

        <div className="flex gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="nb-input min-h-[44px] flex-1"
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
            className="nb-input min-h-[44px] flex-1"
          >
            <option value="">Any Year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        {isFetching && <p className="font-bold text-white/60">Loading…</p>}
        {!isFetching && data?.length === 0 && (
          <p className="font-bold text-white/60">No anime found for these filters.</p>
        )}
        <div className="nb-card bg-ink-800 p-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {data?.map((a) => (
              <PosterCard key={a.id} anime={a} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
