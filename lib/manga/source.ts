import { getMangaDetail, getReaderData } from "./mangadex";
import { isWcChapterId, parseWcChapterId, wcChapterId, wcChapters, wcFindSeries, wcPages } from "./weebcentral";
import { isMrChapterId, mrChapterId, mrFindSeries, mrPages, parseMrChapterId } from "./mangaread";
import { isHostedChapter as isHosted, type MangaChapter, type MangaDetail, type MangaReaderData } from "./types";

function byNumberDesc(a: MangaChapter, b: MangaChapter) {
  const av = Number.parseFloat(a.chapter ?? "");
  const bv = Number.parseFloat(b.chapter ?? "");
  if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
  if (Number.isNaN(av)) return 1;
  if (Number.isNaN(bv)) return -1;
  return bv - av;
}

async function weebcentralChapters(id: string, detail: MangaDetail): Promise<MangaChapter[]> {
  const seriesId = await wcFindSeries({
    key: id,
    titles: [detail.title, ...detail.altTitles],
    anilistId: detail.anilistId,
  });
  if (!seriesId) return [];
  const wc = await wcChapters(seriesId);
  return wc.map((w) => ({
    id: wcChapterId(w.id, id),
    chapter: w.number,
    volume: null,
    title: /^chapter\s+[\d.]+$/i.test(w.label) ? null : w.label,
    pages: 0,
    group: null,
    publishAt: w.date,
    externalUrl: null,
    source: "weebcentral" as const,
  }));
}

async function mangareadChapters(id: string, detail: MangaDetail): Promise<MangaChapter[]> {
  const series = await mrFindSeries({ key: id, titles: [detail.title, ...detail.altTitles] });
  if (!series) return [];
  return series.chapters.map((c) => ({
    id: mrChapterId(series.slug, c.slug, id),
    chapter: c.number,
    volume: null,
    title: /^chapter\s+[\d.]+$/i.test(c.label) ? null : c.label,
    pages: 0,
    group: null,
    publishAt: c.date,
    externalUrl: null,
    source: "mangaread" as const,
  }));
}

// MangaDex where it hosts pages, then WeebCentral, then MangaRead (WeebCentral blocks datacenter IPs).
export async function getMangaFull(id: string): Promise<MangaDetail> {
  const detail = await getMangaDetail(id);
  const [wc, mr] = await Promise.all([
    weebcentralChapters(id, detail).catch(() => [] as MangaChapter[]),
    mangareadChapters(id, detail).catch(() => [] as MangaChapter[]),
  ]);

  const merged = new Map<string, MangaChapter>();
  for (const c of detail.chapters) {
    if (isHosted(c)) merged.set(c.chapter ?? c.id, { ...c, source: "mangadex" });
  }
  for (const c of [...wc, ...mr]) {
    const key = c.chapter ?? c.id;
    if (!merged.has(key)) merged.set(key, c);
  }
  // keep MangaDex's external-only rows visible (locked) when nobody hosts them
  for (const c of detail.chapters) {
    const key = c.chapter ?? c.id;
    if (!merged.has(key)) merged.set(key, { ...c, source: "mangadex" });
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
  if (isMrChapterId(chapterId)) {
    const parsed = parseMrChapterId(chapterId)!;
    const [pages, full] = await Promise.all([mrPages(parsed.slug, parsed.chapter), getMangaFull(parsed.mangaId)]);
    if (pages.length === 0) throw new Error("No pages found for this chapter");
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
