"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { fetchSeasons, type SeasonEntry } from "@/lib/client/api";
import { Row } from "@/components/ui/Row";

const FORMAT_LABEL: Record<string, string> = {
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
  TV_SHORT: "Shorts",
};

export function useSeasons(id: number | null | undefined) {
  return useQuery({
    queryKey: ["seasons", id],
    queryFn: () => fetchSeasons(id as number),
    enabled: id != null,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

function sub(entry: SeasonEntry): string {
  const eps = entry.episodes ? `${entry.episodes} episodes` : entry.status === "NOT_YET_RELEASED" ? "Upcoming" : null;
  return [entry.year, eps].filter(Boolean).join(", ");
}

function SeasonCard({ entry: raw, markCurrent = true }: { entry: SeasonEntry; markCurrent?: boolean }) {
  const entry = markCurrent ? raw : { ...raw, current: false };
  const body = (
    <>
      <span className="poster-frame block h-[64px] w-[45px] shrink-0 rounded-md">
        {entry.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold leading-tight">Season {entry.season}</span>
        <span className={`mt-0.5 block text-[12.5px] ${entry.current ? "text-black/60" : "text-muted"}`}>{sub(entry)}</span>
      </span>
    </>
  );
  const cls = `flex w-[188px] shrink-0 items-center gap-3 rounded-lg p-2 pr-3 transition-colors ${
    entry.current ? "bg-white text-black" : "bg-ink-800 hover:bg-ink-700"
  }`;
  return entry.current ? (
    <span aria-current="page" title={entry.title} className={cls}>
      {body}
    </span>
  ) : (
    <Link href={`/anime/${entry.id}`} title={entry.title} className={cls}>
      {body}
    </Link>
  );
}

// Big season row for detail pages; hidden for single-season shows.
export function SeasonSwitcher({ id, heading, markCurrent = true }: { id: number; heading?: string; markCurrent?: boolean }) {
  const { data, isLoading } = useSeasons(id);
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[80px] w-[188px] shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }
  const seasons = data?.seasons ?? [];
  if (seasons.length <= 1) return null;
  return (
    <Row title={heading ?? `${seasons.length} seasons`}>
      {seasons.map((s) => (
        <SeasonCard key={s.id} entry={s} markCurrent={markCurrent} />
      ))}
    </Row>
  );
}

// Compact picker for tight spaces (watch sidebar).
export function SeasonSelect({ id }: { id: number }) {
  const router = useRouter();
  const { data } = useSeasons(id);
  const options = [...(data?.seasons ?? []), ...(data?.extras ?? [])];
  if (options.length <= 1) return null;
  const current = options.find((o) => o.current);
  return (
    <label className="relative block">
      <span className="sr-only">Season</span>
      <select
        value={current?.id ?? ""}
        onChange={(e) => router.push(`/anime/${e.target.value}`)}
        className="nb-input appearance-none !bg-none pr-10 font-semibold"
        style={{ minHeight: 44 }}
      >
        {!current && <option value="">Choose a season</option>}
        {(data?.seasons ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            Season {s.season} {s.year ? `(${s.year})` : ""}
          </option>
        ))}
        {(data?.extras ?? []).length > 0 && (
          <optgroup label="Movies & specials">
            {data!.extras.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60" />
    </label>
  );
}

// Movies, OVAs and specials as titled posters.
export function FranchiseExtras({ id, title = "Movies & specials" }: { id: number; title?: string }) {
  const { data } = useSeasons(id);
  const extras = data?.extras ?? [];
  if (!extras.length) return null;
  return (
    <Row title={title}>
      {extras.map((e) => (
        <Link key={e.id} href={`/anime/${e.id}`} className="group block aa-poster-w shrink-0">
          <div className="poster-frame aspect-[2/3] ring-1 ring-inset ring-white/[0.06]">
            {e.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.cover} alt={e.title} loading="lazy" className="h-full w-full object-cover" />
            )}
            <span className="on-media absolute left-1.5 top-1.5 rounded-[5px] bg-black/75 px-1.5 py-0.5 text-[10.5px] font-bold text-white">
              {FORMAT_LABEL[e.format ?? ""] ?? "Extra"}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90 group-hover:text-white">{e.title}</p>
          {e.year && <p className="mt-0.5 text-[12px] text-muted">{e.year}</p>}
        </Link>
      ))}
    </Row>
  );
}
