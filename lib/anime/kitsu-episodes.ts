const KITSU = "https://kitsu.io/api/edge";
const HEADERS = { Accept: "application/vnd.api+json" };

export type EpisodeMeta = { number: number; title: string | null; thumbnail: string | null; airdate: string | null };

const idCache = new Map<number, string | null>();

export async function kitsuIdFromMal(malId: number): Promise<string | null> {
  if (idCache.has(malId)) return idCache.get(malId) ?? null;
  const url = `${KITSU}/mappings?filter%5BexternalSite%5D=myanimelist/anime&filter%5BexternalId%5D=${malId}&include=item&fields%5Banime%5D=slug`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { included?: { id: string; type: string }[] };
    const id = json.included?.find((i) => i.type === "anime")?.id ?? null;
    idCache.set(malId, id);
    return id;
  } catch {
    return null;
  }
}

type Raw = { attributes?: { number?: number; canonicalTitle?: string | null; thumbnail?: { original?: string } | null; airdate?: string | null } };

// Kitsu caps pages at 20, so a range is fetched as parallel pages.
export async function getEpisodeMeta(malId: number, from: number, to: number): Promise<EpisodeMeta[]> {
  const kitsuId = await kitsuIdFromMal(malId);
  if (!kitsuId) return [];
  const start = Math.max(1, from);
  const end = Math.min(to, start + 99);
  const offsets: number[] = [];
  for (let o = start - 1; o < end; o += 20) offsets.push(o);
  const pages = await Promise.all(
    offsets.map(async (offset) => {
      const url = `${KITSU}/anime/${kitsuId}/episodes?sort=number&page%5Blimit%5D=20&page%5Boffset%5D=${offset}&fields%5Bepisodes%5D=number,canonicalTitle,thumbnail,airdate`;
      try {
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } } as RequestInit);
        if (!res.ok) return [];
        return ((await res.json()) as { data?: Raw[] }).data ?? [];
      } catch {
        return [];
      }
    }),
  );
  return pages
    .flat()
    .map((e) => ({
      number: e.attributes?.number ?? 0,
      title: e.attributes?.canonicalTitle?.trim() || null,
      thumbnail: e.attributes?.thumbnail?.original ?? null,
      airdate: e.attributes?.airdate ?? null,
    }))
    .filter((e) => e.number >= start && e.number <= end);
}
