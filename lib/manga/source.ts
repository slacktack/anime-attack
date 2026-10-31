import { getMangaDetail, getReaderData } from "./mangadex";
import { isWcChapterId, parseWcChapterId, wcChapterId, wcChapters, wcFindSeries, wcPages } from "./weebcentral";
import type { MangaChapter, MangaDetail, MangaReaderData } from "./types";

const isHosted = (c: MangaChapter) => (c.pages > 0 || c.source === "weebcentral") && !c.externalUrl;

function byNumberDesc(a: MangaChapter, b: MangaChapter) {
  const av = Number.parseFloat(a.chapter ?? "");
  const bv = Number.parseFloat(b.chapter ?? "");
  if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
  if (Number.isNaN(av)) return 1;
  if (Number.isNaN(bv)) return -1;
  return bv - av;
}

// MangaDex where it hosts pages, WeebCentral for licensed/external-only or truncated runs.
export async function getMangaFull(id: string): Promise<MangaDetail> {
  const detail = await getMangaDetail(id);
  // Always merge: MangaDex often hosts only a handful of chapters (Komi, Mushoku Tensei).

  let seriesId: string | null = null;
  try {
    seriesId = await wcFindSeries({
      key: id,
      titles: [detail.title, ...detail.altTitles],
      anilistId: detail.anilistId,
    });
  } catch {
    seriesId = null;
  }
  if (!seriesId) return { ...detail, chapters: detail.chapters.map((c) => ({ ...c, source: "mangadex" as const })) };

  let wc: Awaited<ReturnType<typeof wcChapters>> = [];
  try {
    wc = await wcChapters(seriesId);
  } catch {
    return detail;
  }

  const merged = new Map<string, MangaChapter>();
  for (const c of detail.chapters) {
    if (isHosted(c)) merged.set(c.chapter ?? c.id, { ...c, source: "mangadex" });
  }
  for (const w of wc) {
    const key = w.number ?? w.id;
    if (merged.has(key)) continue;
    merged.set(key, {
      id: wcChapterId(w.id, id),
      chapter: w.number,
      volume: null,
      title: /^chapter\s+[\d.]+$/i.test(w.label) ? null : w.label,
      pages: 0,
      group: null,
      publishAt: w.date,
      externalUrl: null,
      source: "weebcentral",
    });
  }
  return { ...detail, chapters: [...merged.values()].sort(byNumberDesc) };
}

function navFrom(list: MangaChapter[], chapterId: string) {
  const asc = [...list].filter(isHosted).sort((a, b) => -byNumberDesc(a, b));
  const i = asc.findIndex((c) => c.id === chapterId);
  return {
    prev: i > 0 ? { id: asc[i - 1].id, chapter: asc[i - 1].chapter } : null,
    next: i >= 0 && i < asc.length - 1 ? { id: asc[i + 1].id, chapter: asc[i + 1].chapter } : null,
  };
}

const proxied = (url: string) => `/api/manga/image?url=${encodeURIComponent(url)}`;

export async function getChapter(chapterId: string): Promise<MangaReaderData> {
  if (isWcChapterId(chapterId)) {
    const parsed = parseWcChapterId(chapterId)!;
    const [pages, full] = await Promise.all([wcPages(parsed.ulid), getMangaFull(parsed.mangaId)]);
    const entry = full.chapters.find((c) => c.id === chapterId);
    const urls = pages.map(proxied);
    return {
      chapterId,
      mangaId: parsed.mangaId,
      mangaTitle: full.title,
      chapter: entry?.chapter ?? null,
      volume: null,
      title: entry?.title ?? null,
      pages: urls,
      saverPages: urls,
      ...navFrom(full.chapters, chapterId),
    };
  }
  const data = await getReaderData(chapterId);
  try {
    const full = await getMangaFull(data.mangaId);
    return { ...data, ...navFrom(full.chapters, chapterId) };
  } catch {
    return data;
  }
}
