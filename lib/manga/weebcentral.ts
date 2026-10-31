const BASE = "https://weebcentral.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ULID = /[0-9A-Z]{26}/;

export type WcChapter = { id: string; number: string | null; label: string; date: string | null };

async function html(path: string, init: RequestInit & { revalidate?: number } = {}): Promise<string> {
  const { revalidate = 600, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { "User-Agent": UA, "HX-Request": "true", ...(rest.headers ?? {}) },
    signal: AbortSignal.timeout(12000),
    next: { revalidate },
  } as RequestInit);
  if (!res.ok) throw new Error(`WeebCentral ${res.status}`);
  return res.text();
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function wcSearch(text: string): Promise<{ id: string; title: string }[]> {
  const body = await html(`/search/simple?location=main`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `text=${encodeURIComponent(text)}`,
    revalidate: 86400,
  });
  const out: { id: string; title: string }[] = [];
  const re = /href="https:\/\/weebcentral\.com\/series\/([0-9A-Z]{26})\/[^"]*"[\s\S]*?alt="([^"]*?) cover"/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (!out.some((o) => o.id === m![1])) out.push({ id: m[1], title: decode(m[2]) });
  }
  return out;
}

export async function wcSeriesLinks(id: string): Promise<{ anilist: number | null; names: string[] }> {
  const body = await html(`/series/${id}/x`, { revalidate: 86400 });
  const al = body.match(/anilist\.co\/manga\/(\d+)/);
  const namesBlock = body.match(/Associated Name\(s\)[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/);
  const names = namesBlock ? [...namesBlock[1].matchAll(/<li[^>]*>([^<]+)<\/li>/g)].map((x) => decode(x[1])) : [];
  return { anilist: al ? Number(al[1]) : null, names };
}

export async function wcChapters(seriesId: string): Promise<WcChapter[]> {
  const body = await html(`/series/${seriesId}/full-chapter-list`, { revalidate: 600 });
  const out: WcChapter[] = [];
  const re = /href="(?:https:\/\/weebcentral\.com)?\/chapters\/([0-9A-Z]{26})"[\s\S]*?<span class="">([^<]+)<\/span>[\s\S]*?datetime="([^"]+)"/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const label = decode(m[2]);
    const num = label.match(/(\d+(?:\.\d+)?)/);
    out.push({ id: m[1], label, number: num ? String(Number(num[1])) : null, date: m[3] });
  }
  return out;
}

export async function wcPages(chapterId: string): Promise<string[]> {
  const body = await html(`/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`, {
    revalidate: 3600,
  });
  return [...body.matchAll(/<img[^>]+src="(https:\/\/[^"]+)"[^>]*alt="Page \d+"/g)].map((m) => m[1]);
}

// Finds the WeebCentral series for a MangaDex title; AniList id makes the match exact when present.
const seriesCache = new Map<string, { at: number; id: string | null }>();

export async function wcFindSeries(opts: { key: string; titles: string[]; anilistId?: number | null }): Promise<string | null> {
  const hit = seriesCache.get(opts.key);
  if (hit && Date.now() - hit.at < (hit.id ? 7 * 86400_000 : 3600_000)) return hit.id;

  const wanted = new Set(opts.titles.map(norm).filter(Boolean));
  let found: string | null = null;
  for (const title of opts.titles.slice(0, 3)) {
    let results: { id: string; title: string }[] = [];
    try {
      results = await wcSearch(title);
    } catch {
      continue;
    }
    for (const r of results.slice(0, 5)) {
      const exact = wanted.has(norm(r.title));
      if (!exact && !opts.anilistId) continue;
      try {
        const links = await wcSeriesLinks(r.id);
        if (opts.anilistId && links.anilist === opts.anilistId) {
          found = r.id;
          break;
        }
        const names = [r.title, ...links.names].map(norm);
        if (!opts.anilistId && names.some((n) => wanted.has(n))) {
          found = r.id;
          break;
        }
        if (opts.anilistId && links.anilist == null && exact) {
          found = r.id;
          break;
        }
      } catch {
        /* next candidate */
      }
    }
    if (found) break;
  }
  seriesCache.set(opts.key, { at: Date.now(), id: found });
  return found;
}

export const isWcChapterId = (id: string) => /^wc\.[0-9A-Z]{26}\.[a-f0-9-]{36}$/i.test(id);
export const wcChapterId = (ulid: string, mangaId: string) => `wc.${ulid}.${mangaId}`;
export function parseWcChapterId(id: string): { ulid: string; mangaId: string } | null {
  const [, ulid, mangaId] = id.split(".");
  return ULID.test(ulid ?? "") && mangaId ? { ulid, mangaId } : null;
}
