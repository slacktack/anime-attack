import type {
  MangaCard,
  MangaChapter,
  MangaChapterNav,
  MangaDetail,
  MangaReaderData,
} from "./types";

const API = "https://api.mangadex.org";
const UPLOADS = "https://uploads.mangadex.org";
const UA = "AnimeAttack/1.0 (https://github.com/slacktack/anime-attack)";

type Rec = Record<string, any>;

async function api<T>(path: string, revalidate = 300): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`MangaDex returned ${res.status}`);
  }
  return (await res.json()) as T;
}

function titleOf(attrs: Rec): string {
  const titles = attrs?.title ?? {};
  return titles.en || titles["ja-ro"] || Object.values(titles)[0] || "Untitled";
}

function descriptionOf(attrs: Rec): string {
  const desc = attrs?.description ?? {};
  return desc.en || Object.values(desc)[0] || "";
}

function proxiedImage(url: string | null): string | null {
  return url ? `/api/manga/image?url=${encodeURIComponent(url)}` : null;
}

function coverOf(mangaId: string, relationships: Rec[]): string | null {
  const rel = (relationships ?? []).find((r) => r.type === "cover_art");
  const file = rel?.attributes?.fileName;
  return file ? proxiedImage(`${UPLOADS}/covers/${mangaId}/${file}.512.jpg`) : null;
}

function mapCard(manga: Rec): MangaCard {
  const attrs = manga?.attributes ?? {};
  return {
    id: manga.id,
    title: titleOf(attrs),
    description: descriptionOf(attrs),
    cover: coverOf(manga.id, manga.relationships ?? []),
    status: attrs.status ?? null,
    year: attrs.year ?? null,
    tags: (attrs.tags ?? [])
      .map((tag: Rec) => tag?.attributes?.name?.en)
      .filter((tag: unknown): tag is string => typeof tag === "string")
      .slice(0, 8),
    contentRating: attrs.contentRating ?? null,
    latestChapter: attrs.lastChapter || null,
  };
}

function mapChapter(chapter: Rec): MangaChapter {
  const attrs = chapter?.attributes ?? {};
  const group = (chapter.relationships ?? []).find((r: Rec) => r.type === "scanlation_group");
  return {
    id: chapter.id,
    chapter: attrs.chapter ?? null,
    volume: attrs.volume ?? null,
    title: attrs.title ?? null,
    pages: attrs.pages ?? 0,
    group: group?.attributes?.name ?? null,
    publishAt: attrs.publishAt ?? null,
    externalUrl: attrs.externalUrl ?? null,
  };
}

export type MangaList = {
  items: MangaCard[];
  page: number;
  limit: number;
  total: number;
};

export async function listManga(opts: {
  query?: string;
  page?: number;
  order?: "popular" | "latest";
  limit?: number;
  /** Only titles that actually have hosted chapters we can render in the reader. */
  readable?: boolean;
}): Promise<MangaList> {
  const limit = opts.limit ?? 24;
  const page = Math.max(0, opts.page ?? 0);
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(page * limit));
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");
  params.append("includes[]", "cover_art");
  // NOTE: /manga rejects translatedLanguage[] (that is a chapter-feed param);
  // the list endpoint uses availableTranslatedLanguage[].
  params.append("availableTranslatedLanguage[]", "en");
  if (opts.readable) params.set("hasAvailableChapters", "true");
  if (opts.query?.trim()) {
    params.set("title", opts.query.trim());
    params.set("order[relevance]", "desc");
  } else if (opts.order === "latest") {
    params.set("order[latestUploadedChapter]", "desc");
  } else {
    params.set("order[followedCount]", "desc");
  }

  const data = await api<{ data: Rec[]; total: number }>(`/manga?${params.toString()}`);
  return {
    items: (data.data ?? []).map(mapCard),
    page,
    limit,
    total: data.total ?? 0,
  };
}

export async function getMangaDetail(id: string): Promise<MangaDetail> {
  const data = await api<{ data: Rec }>(`/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`);
  const manga = data.data;
  const card = mapCard(manga);

  const authors: string[] = [];
  const artists: string[] = [];
  for (const rel of manga.relationships ?? []) {
    const name = rel?.attributes?.name;
    if (!name) continue;
    if (rel.type === "author") authors.push(name);
    if (rel.type === "artist") artists.push(name);
  }

  const feedParams = new URLSearchParams();
  feedParams.set("limit", "500");
  feedParams.append("translatedLanguage[]", "en");
  feedParams.set("order[chapter]", "desc");
  feedParams.set("includeFutureUpdates", "0");

  let chapters: MangaChapter[] = [];
  try {
    const feed = await api<{ data: Rec[] }>(`/manga/${id}/feed?${feedParams.toString()}`);
    const seen = new Map<string, MangaChapter>();
    for (const chapter of (feed.data ?? []).map(mapChapter)) {
      const key = chapter.chapter ?? chapter.id;
      const existing = seen.get(key);
      const hosted = chapter.pages > 0 && !chapter.externalUrl;
      const existingHosted = existing ? existing.pages > 0 && !existing.externalUrl : false;
      if (!existing || (hosted && !existingHosted)) seen.set(key, chapter);
    }
    chapters = [...seen.values()]
      .sort((a, b) => {
        const av = Number.parseFloat(a.chapter ?? "");
        const bv = Number.parseFloat(b.chapter ?? "");
        if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
        if (Number.isNaN(av)) return 1;
        if (Number.isNaN(bv)) return -1;
        return bv - av;
      });
  } catch {
    chapters = [];
  }

  return {
    ...card,
    authors,
    artists,
    altTitles: (manga.attributes?.altTitles ?? [])
      .map((alt: Rec) => alt?.en)
      .filter((alt: unknown): alt is string => typeof alt === "string")
      .slice(0, 6),
    chapters,
  };
}

export async function getReaderData(chapterId: string): Promise<MangaReaderData> {
  const chapterRes = await api<{ data: Rec }>(`/chapter/${chapterId}?includes[]=manga`, 600);
  const chapter = chapterRes.data;
  const attrs = chapter.attributes ?? {};
  const mangaId = (chapter.relationships ?? []).find((r: Rec) => r.type === "manga")?.id;
  if (!mangaId) throw new Error("Chapter has no manga attached");

  const mangaRes = await api<{ data: Rec }>(`/manga/${mangaId}?includes[]=cover_art`, 3600);
  const mangaTitle = titleOf(mangaRes.data?.attributes ?? {});

  const atHome = await fetch(`${API}/at-home/server/${chapterId}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!atHome.ok) throw new Error(`Pages are not available (${atHome.status})`);
  const home = (await atHome.json()) as {
    baseUrl: string;
    chapter: { hash: string; data: string[]; dataSaver: string[] };
  };

  const build = (files: string[]) =>
    (files ?? []).map((file) =>
      proxiedImage(`${home.baseUrl}/data/${home.chapter.hash}/${file}`) as string,
    );

  let prev: MangaChapterNav = null;
  let next: MangaChapterNav = null;
  try {
    const feedParams = new URLSearchParams();
    feedParams.set("limit", "500");
    feedParams.append("translatedLanguage[]", "en");
    feedParams.set("order[chapter]", "asc");
    const feed = await api<{ data: Rec[] }>(`/manga/${mangaId}/feed?${feedParams.toString()}`, 600);
    const list = (feed.data ?? [])
      .map(mapChapter)
      .filter((chapterItem) => chapterItem.pages > 0)
      .sort((a, b) => {
        const av = Number.parseFloat(a.chapter ?? "");
        const bv = Number.parseFloat(b.chapter ?? "");
        if (Number.isNaN(av)) return 1;
        if (Number.isNaN(bv)) return -1;
        return av - bv;
      });
    const index = list.findIndex((item) => item.id === chapterId);
    if (index > 0) prev = { id: list[index - 1].id, chapter: list[index - 1].chapter };
    if (index >= 0 && index < list.length - 1) {
      next = { id: list[index + 1].id, chapter: list[index + 1].chapter };
    }
  } catch {
    prev = null;
    next = null;
  }

  return {
    chapterId,
    mangaId,
    mangaTitle,
    chapter: attrs.chapter ?? null,
    volume: attrs.volume ?? null,
    title: attrs.title ?? null,
    pages: build(home.chapter.data),
    saverPages: (home.chapter.dataSaver ?? []).map((file) =>
      proxiedImage(`${home.baseUrl}/data-saver/${home.chapter.hash}/${file}`) as string,
    ),
    prev,
    next,
  };
}
