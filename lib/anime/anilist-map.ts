import {
  Anime,
  AnimeSchema,
  AnimeSummary,
  AnimeSummarySchema,
  Character,
  CharacterSchema,
  RelatedAnime,
  RelatedAnimeSchema,
} from "./types";

type Rec = Record<string, any>;

function title(m: Rec): string {
  return m?.title?.english || m?.title?.romaji || m?.title?.native || "Untitled";
}
function scale(score: unknown): number | null {
  return typeof score === "number" ? Math.round(score) / 10 : null;
}
function normType(fmt: unknown): AnimeSummary["type"] {
  const valid = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"];
  return typeof fmt === "string" && valid.includes(fmt) ? (fmt as AnimeSummary["type"]) : null;
}

export function mapMediaToSummary(media: unknown): AnimeSummary {
  const m = media as Rec;
  return AnimeSummarySchema.parse({
    id: m.id, title: title(m),
    cover: m?.coverImage?.large || m?.coverImage?.medium || "",
    banner: m?.bannerImage ?? null,
    type: normType(m?.format), score: scale(m?.averageScore),
    year: typeof m?.seasonYear === "number" ? m.seasonYear : null,
  });
}

export function mapMediaToAnime(media: unknown): Anime {
  const m = media as Rec;
  const next = m?.nextAiringEpisode;
  return AnimeSchema.parse({
    ...mapMediaToSummary(media),
    bannerImage: m?.bannerImage ?? null,
    description: m?.description ?? null,
    genres: Array.isArray(m?.genres) ? m.genres : [],
    status: m?.status ?? null,
    episodes: typeof m?.episodes === "number" ? m.episodes : null,
    studios: Array.isArray(m?.studios?.nodes) ? m.studios.nodes.map((n: Rec) => n.name) : [],
    seasonYear: typeof m?.seasonYear === "number" ? m.seasonYear : null,
    nextAiringEpisode:
      next && typeof next.episode === "number" && typeof next.airingAt === "number"
        ? { episode: next.episode, airingAt: next.airingAt }
        : null,
  });
}

export function mapRelationEdge(edge: unknown): RelatedAnime {
  const e = edge as Rec;
  const node = e?.node ?? {};
  return RelatedAnimeSchema.parse({
    ...mapMediaToSummary(node),
    relationType: typeof e?.relationType === "string" ? e.relationType : "RELATED",
    episodes: typeof node?.episodes === "number" ? node.episodes : null,
    status: node?.status ?? null,
  });
}

export function mapCharacterEdge(edge: unknown): Character {
  const e = edge as Rec;
  const n = e?.node ?? {};
  return CharacterSchema.parse({
    id: n.id,
    name: n?.name?.full || n?.name?.native || "Unknown",
    image: n?.image?.large ?? null,
    role: e?.role ?? null,
    voiceActor: e?.voiceActors?.[0]?.name?.full ?? null,
  });
}
