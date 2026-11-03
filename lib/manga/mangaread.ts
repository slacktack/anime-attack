import { norm } from "./weebcentral";

const BASE = "https://www.mangaread.org";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export type MrChapter = { slug: string; number: string | null; label: string; date: string | null };
export type MrSeries = { slug: string; title: string; altNames: string[]; chapters: MrChapter[] };

async function html(path: string, init: RequestInit & { revalidate?: number } = {}): Promise<string> {
  const { revalidate = 600, ...rest } = init;
  const res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
    ...rest,
    headers: { "User-Agent": UA, Referer: `${BASE}/`, ...(rest.headers ?? {}) },
    signal: AbortSignal.timeout(12000),
    next: { revalidate },
  } as RequestInit);
  if (!res.ok) throw new Error(`MangaRead ${res.status}`);
  const body = await res.text();
  if (/<title>Just a moment/i.test(body)) throw new Error("MangaRead challenge");
  return body;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&#8217;|’/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function mrSearch(text: string): Promise<{ slug: string; title: string }[]> {
  const body = await html(`/?s=${encodeURIComponent(text)}&post_type=wp-manga`, { revalidate: 86400 });
  const out: { slug: string; title: string }[] = [];
  const re = /<h3 class="h4">\s*<a href="https:\/\/www\.mangaread\.org\/manga\/([a-z0-9-]+)\/">([^<]+)/gi;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (!out.some((o) => o.slug === m![1])) out.push({ slug: m[1], title: decode(m[2]) });
  }
  return out;
}

function parseDate(raw: string | undefined): string | null {
  const m = raw?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T00:00:00Z` : null;
}

function parseChapters(body: string, slug: string): MrChapter[] {
  const out: MrChapter[] = [];
  const re = new RegExp(
    `<a href="https://www\\.mangaread\\.org/manga/${slug}/([a-z0-9._-]+)/">([^<]+)</a>(?:\\s*<span class="chapter-release-date">\\s*<i>([^<]*)</i>)?`,
    "gi",
  );
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (out.some((c) => c.slug === m![1])) continue;
    const label = decode(m[2]);
    const num = label.match(/chapter\s*(\d+(?:\.\d+)?)/i) ?? m[1].match(/chapter-(\d+(?:[.-]\d+)?)/i);
    out.push({
      slug: m[1],
      label,
      number: num ? String(Number(num[1].replace("-", "."))) : null,
      date: parseDate(m[3]),
    });
  }
  return out;
}

export async function mrSeries(slug: string): Promise<MrSeries> {
  const body = await html(`/manga/${slug}/`, { revalidate: 600 });
  const title = decode(body.match(/<div class="post-title">[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") ?? "");
  const alt = body.match(/Alternative\s*<\/h5>\s*<\/div>\s*<div class="summary-content">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const altNames = decode(alt).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  let chapters = parseChapters(body, slug);
  if (chapters.length === 0) {
    // newer Madara builds load the list over ajax
    const ajax = await html(`/manga/${slug}/ajax/chapters/`, { method: "POST", revalidate: 600 }).catch(() => "");
    chapters = parseChapters(ajax, slug);
  }
  return { slug, title, altNames, chapters };
}

export async function mrPages(slug: string, chapter: string): Promise<string[]> {
  const body = await html(`/manga/${slug}/${chapter}/`, { revalidate: 3600 });
  return [...body.matchAll(/<img[^>]*?(?:data-src|src)="\s*(https:\/\/[^"\s]+)\s*"[^>]*class="wp-manga-chapter-img"/g)].map(
    (m) => m[1],
  );
}

const seriesCache = new Map<string, { at: number; series: MrSeries | null }>();

// Exact title/alt-name match only; near misses (sequels, novels) are worse than nothing.
export async function mrFindSeries(opts: { key: string; titles: string[] }): Promise<MrSeries | null> {
  const hit = seriesCache.get(opts.key);
  if (hit && Date.now() - hit.at < (hit.series ? 600_000 : 3600_000)) return hit.series;

  const wanted = new Set(opts.titles.map(norm).filter(Boolean));
  const seen = new Set<string>();
  let found: MrSeries | null = null;
  for (const title of opts.titles.slice(0, 3)) {
    let results: { slug: string; title: string }[] = [];
    try {
      results = await mrSearch(title);
    } catch {
      continue;
    }
    for (const r of results.slice(0, 4)) {
      if (seen.has(r.slug)) continue;
      seen.add(r.slug);
      try {
        const series = await mrSeries(r.slug);
        const names = [r.title, series.title, ...series.altNames].map(norm);
        if (series.chapters.length > 0 && names.some((n) => wanted.has(n))) {
          found = series;
          break;
        }
      } catch {
        /* next candidate */
      }
    }
    if (found) break;
  }
  seriesCache.set(opts.key, { at: Date.now(), series: found });
  return found;
}

export const isMrChapterId = (id: string) => /^mr~[a-z0-9-]+~[a-z0-9._-]+~[a-f0-9-]{36}$/i.test(id);
export const mrChapterId = (slug: string, chapter: string, mangaId: string) => `mr~${slug}~${chapter}~${mangaId}`;
export function parseMrChapterId(id: string): { slug: string; chapter: string; mangaId: string } | null {
  if (!isMrChapterId(id)) return null;
  const [, slug, chapter, mangaId] = id.split("~");
  return { slug, chapter, mangaId };
}
