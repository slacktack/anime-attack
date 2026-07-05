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
