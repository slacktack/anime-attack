import { anilistFetch } from "./anilist";
import { mapMediaToSummary } from "./anilist-map";
import {
  AnimeExtrasSchema,
  CharacterCardSchema,
  CharacterFullSchema,
  ScheduleEntrySchema,
  type AnimeExtras,
  type CharacterCard,
  type CharacterFull,
  type ScheduleEntry,
} from "./extra-types";
import type { AnimeSummary } from "./types";

type Rec = Record<string, any>;

const MEDIA_FIELDS = `
  id title { english romaji native } coverImage { extraLarge large medium }
  bannerImage format averageScore seasonYear episodes status genres
  studios(isMain: true) { nodes { name } }`;

const BROWSE_CHARACTERS = `
  query ($page: Int, $search: String) {
    Page(page: $page, perPage: 30) {
      characters(sort: FAVOURITES_DESC, search: $search) {
        id name { full } image { large } favourites
      }
    }
  }`;

const CHARACTER_FULL = `
  query ($id: Int) {
    Character(id: $id) {
      id
      name { full native }
      image { large }
      description(asHtml: false)
      gender
      age
      favourites
      media(sort: POPULARITY_DESC, perPage: 12) {
        nodes { ${MEDIA_FIELDS} }
      }
    }
  }`;

const SCHEDULE = `
  query ($page: Int) {
    Page(page: $page, perPage: 40) {
      airingSchedules(notYetAired: true, sort: TIME) {
        id
        episode
        airingAt
        media {
          id
          title { english romaji }
          coverImage { large }
        }
      }
    }
  }`;

const BROWSE_ANIME = `
  query ($genre: String, $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
    Page(perPage: 30) {
      media(type: ANIME, genre: $genre, seasonYear: $year, season: $season, format: $format, status: $status, sort: $sort) {
        ${MEDIA_FIELDS}
      }
    }
  }`;

const GENRE_COLLECTION = `query { GenreCollection }`;

const ANIME_EXTRAS = `
  query ($id: Int) {
    Media(id: $id) {
      idMal
      coverImage { color }
    }
  }`;

function mapCharacterCard(node: unknown): CharacterCard {
  const n = node as Rec;
  return CharacterCardSchema.parse({
    id: n.id,
    name: n?.name?.full || "Unknown",
    image: n?.image?.large ?? null,
    favourites: typeof n?.favourites === "number" ? n.favourites : 0,
  });
}

export const browseCharacters = (page = 1, search?: string): Promise<CharacterCard[]> => {
  const variables: Rec = { page };
  if (search) variables.search = search;
  return anilistFetch<Rec>(BROWSE_CHARACTERS, variables).then((d) =>
    (d?.Page?.characters ?? []).map(mapCharacterCard),
  );
};

export const getCharacterFull = (id: number): Promise<CharacterFull> =>
  anilistFetch<Rec>(CHARACTER_FULL, { id }).then((d) => {
    const c = d?.Character ?? {};
    const media: AnimeSummary[] = (c?.media?.nodes ?? []).map(mapMediaToSummary);
    return CharacterFullSchema.parse({
      id: c.id,
      name: c?.name?.full || "Unknown",
      image: c?.image?.large ?? null,
      favourites: typeof c?.favourites === "number" ? c.favourites : 0,
      native: c?.name?.native ?? null,
      description: c?.description ?? null,
      gender: c?.gender ?? null,
      age: c?.age ?? null,
      media,
    }) as CharacterFull;
  });

function mapScheduleEntry(entry: unknown): ScheduleEntry {
  const e = entry as Rec;
  const m = e?.media ?? {};
  return ScheduleEntrySchema.parse({
    id: e.id,
    title: m?.title?.english || m?.title?.romaji || "Untitled",
    cover: m?.coverImage?.large || "",
    episode: e.episode,
    airingAt: e.airingAt,
  });
}

export const getSchedule = (page = 1): Promise<ScheduleEntry[]> =>
  anilistFetch<Rec>(SCHEDULE, { page }).then((d) =>
    (d?.Page?.airingSchedules ?? []).map(mapScheduleEntry),
  );

export interface BrowseAnimeFilters {
  genre?: string;
  year?: number;
  season?: string;
  format?: string;
  status?: string;
  sort?: string;
}

export const browseAnime = (f: BrowseAnimeFilters = {}): Promise<AnimeSummary[]> => {
  const variables: Rec = { sort: f.sort ?? "POPULARITY_DESC" };
  if (f.genre !== undefined) variables.genre = f.genre;
  if (f.year !== undefined) variables.year = f.year;
  if (f.season !== undefined) variables.season = f.season;
  if (f.format !== undefined) variables.format = f.format;
  if (f.status !== undefined) variables.status = f.status;
  return anilistFetch<Rec>(BROWSE_ANIME, variables).then((d) =>
    (d?.Page?.media ?? []).map(mapMediaToSummary),
  );
};

export const getGenreCollection = (): Promise<string[]> =>
  anilistFetch<Rec>(GENRE_COLLECTION).then((d) => (Array.isArray(d?.GenreCollection) ? d.GenreCollection : []));

export const getAnimeExtras = (id: number): Promise<AnimeExtras> =>
  anilistFetch<Rec>(ANIME_EXTRAS, { id }).then((d) => {
    const m = d?.Media ?? {};
    return AnimeExtrasSchema.parse({
      idMal: typeof m?.idMal === "number" ? m.idMal : null,
      color: m?.coverImage?.color ?? null,
    });
  });
