export type MangaCard = {
  id: string;
  title: string;
  description: string;
  cover: string | null;
  status: string | null;
  year: number | null;
  tags: string[];
  contentRating: string | null;
  latestChapter: string | null;
};

export type MangaChapter = {
  id: string;
  chapter: string | null;
  volume: string | null;
  title: string | null;
  pages: number;
  group: string | null;
  publishAt: string | null;
  externalUrl: string | null;
  source?: "mangadex" | "weebcentral";
};

export type MangaDetail = MangaCard & {
  authors: string[];
  artists: string[];
  altTitles: string[];
  anilistId?: number | null;
  chapters: MangaChapter[];
};

export type MangaChapterNav = {
  id: string;
  chapter: string | null;
} | null;

export type MangaReaderData = {
  chapterId: string;
  mangaId: string;
  mangaTitle: string;
  chapter: string | null;
  volume: string | null;
  title: string | null;
  pages: string[];
  saverPages: string[];
  prev: MangaChapterNav;
  next: MangaChapterNav;
};
