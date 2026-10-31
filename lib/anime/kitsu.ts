import { AnimeSummary, AnimeSummarySchema, AnimeType } from "./types";

type Rec = Record<string, any>;

function mapSubtype(subtype: unknown): AnimeType | null {
  if (typeof subtype !== "string") return null;
  switch (subtype.toLowerCase()) {
    case "tv":
      return "TV";
    case "movie":
      return "MOVIE";
    case "ova":
      return "OVA";
    case "ona":
      return "ONA";
    case "special":
      return "SPECIAL";
    case "music":
      return "MUSIC";
    default:
      return null;
  }
}

function mapKitsuItem(item: Rec): AnimeSummary {
  const attributes = item.attributes ?? {};
  const titles = attributes.titles ?? {};
  const averageRating = attributes.averageRating;
  const startDate: string | undefined = attributes.startDate;

  return AnimeSummarySchema.parse({
    id: Number(item.id),
    title: titles.en || attributes.canonicalTitle,
    cover: attributes.posterImage?.original ?? attributes.posterImage?.large ?? "",
    banner: attributes.coverImage?.original ?? null,
    type: mapSubtype(attributes.subtype),
    score: averageRating ? Math.round(Number(averageRating)) / 10 : null,
    year: startDate ? Number(startDate.slice(0, 4)) : null,
  });
}

export async function searchKitsu(q: string): Promise<AnimeSummary[]> {
  try {
    const res = await fetch(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=20`,
      {
        headers: { Accept: "application/vnd.api+json" },
        next: { revalidate: 3600 },
      } as RequestInit
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Rec[] };
    return (json.data ?? []).map(mapKitsuItem);
  } catch {
    return [];
  }
}

export async function getKitsuTrending(): Promise<AnimeSummary[]> {
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime?sort=-userCount&page[limit]=20`, {
      headers: { Accept: "application/vnd.api+json" },
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Rec[] };
    return (json.data ?? []).map(mapKitsuItem);
  } catch {
    return [];
  }
}

const backdropCache = new Map<number, string | null>();

// High-res landscape art (3360x800) via Kitsu's MAL mapping; AniList banners are only 1900x400.
export async function getKitsuBackdrop(malId: number): Promise<string | null> {
  if (backdropCache.has(malId)) return backdropCache.get(malId) ?? null;
  try {
    const url = `https://kitsu.io/api/edge/mappings?filter%5BexternalSite%5D=myanimelist/anime&filter%5BexternalId%5D=${malId}&include=item&fields%5Banime%5D=coverImage`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.api+json" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { included?: { attributes?: { coverImage?: Record<string, string> | null } }[] };
    const cover = json.included?.[0]?.attributes?.coverImage;
    const value = cover?.large || cover?.original || null;
    backdropCache.set(malId, value);
    return value;
  } catch {
    return null;
  }
}
