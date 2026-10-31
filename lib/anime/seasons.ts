import { anilistFetch } from "./anilist";

type Rec = Record<string, any>;

export type SeasonEntry = {
  id: number;
  title: string;
  cover: string;
  format: string | null;
  year: number | null;
  episodes: number | null;
  status: string | null;
  season: number | null;
  current: boolean;
};

const NODE = `id type format episodes status seasonYear
  startDate { year month day }
  title { english romaji native }
  coverImage { extraLarge large }`;

const QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    ${NODE}
    relations { edges { relationType node { ${NODE} } } }
  }
}`;

const SEASON_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
const WALK_FORMATS = new Set(["TV", "TV_SHORT", "ONA", "MOVIE", "SPECIAL", "OVA"]);
const EXTRA_RELATIONS = new Set(["SIDE_STORY", "SPIN_OFF", "ALTERNATIVE", "PARENT", "SUMMARY"]);
const MAX_NODES = 24;
const TTL = 60 * 60_000;

const cache = new Map<number, { expires: number; value: { seasons: SeasonEntry[]; extras: SeasonEntry[] } }>();

function toEntry(m: Rec, currentId: number): SeasonEntry {
  return {
    id: m.id,
    title: m?.title?.english || m?.title?.romaji || m?.title?.native || "Untitled",
    cover: m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? "",
    format: m?.format ?? null,
    year: m?.startDate?.year ?? m?.seasonYear ?? null,
    episodes: typeof m?.episodes === "number" ? m.episodes : null,
    status: m?.status ?? null,
    season: null,
    current: m.id === currentId,
  };
}

function startKey(m: Rec): number {
  const d = m?.startDate ?? {};
  return (d.year ?? 9999) * 10000 + (d.month ?? 12) * 100 + (d.day ?? 31);
}

// Walks the PREQUEL/SEQUEL chain in both directions so every season shows, not just neighbours.
export async function getSeasonFamily(id: number) {
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.value;

  const nodes = new Map<number, Rec>();
  const extras = new Map<number, Rec>();
  let frontier = [id];
  const fetched = new Set<number>();

  while (frontier.length && fetched.size < MAX_NODES) {
    const batch = frontier.filter((x) => !fetched.has(x)).slice(0, MAX_NODES - fetched.size);
    batch.forEach((x) => fetched.add(x));
    const results = await Promise.all(
      batch.map((x) => anilistFetch<Rec>(QUERY, { id: x }).then((d) => d?.Media).catch(() => null)),
    );
    const next: number[] = [];
    for (const media of results) {
      if (!media) continue;
      nodes.set(media.id, media);
      for (const edge of media?.relations?.edges ?? []) {
        const n = edge?.node;
        if (!n || n.type !== "ANIME" || n.format === "MUSIC") continue;
        if ((edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL") && WALK_FORMATS.has(n.format)) {
          if (!nodes.has(n.id)) nodes.set(n.id, n);
          if (!fetched.has(n.id)) next.push(n.id);
        } else if (media.id === id && EXTRA_RELATIONS.has(edge.relationType)) {
          extras.set(n.id, n);
        }
      }
    }
    frontier = [...new Set(next)];
  }

  const chain = [...nodes.values()].sort((a, b) => startKey(a) - startKey(b));
  let n = 0;
  const seasons: SeasonEntry[] = [];
  const extraList: SeasonEntry[] = [];
  for (const m of chain) {
    const entry = toEntry(m, id);
    if (SEASON_FORMATS.has(m.format)) {
      entry.season = ++n;
      seasons.push(entry);
    } else {
      extraList.push(entry);
    }
  }
  const chainExtras = [...extraList];
  for (const m of extras.values()) {
    if (!nodes.has(m.id)) extraList.push(toEntry(m, id));
  }
  extraList.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  const value = { seasons, extras: extraList };
  cache.set(id, { expires: Date.now() + TTL, value });
  // Siblings share the chain, so warm their cache too (their own side stories are skipped).
  for (const sib of seasons) {
    if (sib.id === id || cache.has(sib.id)) continue;
    cache.set(sib.id, {
      expires: Date.now() + TTL,
      value: { seasons: seasons.map((x) => ({ ...x, current: x.id === sib.id })), extras: chainExtras },
    });
  }
  return value;
}
