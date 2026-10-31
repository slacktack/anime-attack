import { z } from "zod";
import {
  AniwatchEpisodeSchema,
  AniwatchCategorySchema,
  AniwatchVideoSourceSchema,
  BASE_URL,
  type AniwatchEpisode,
  type AniwatchCategory,
  type AniwatchVideoSource,
} from "./aniwatch-types";

// ── Shared constants ────────────────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const REFERER = BASE_URL;
const API_BASE = `${BASE_URL}/wp-json/wp/v2`;

// ── Proxy helper for client-side requests ─────────────────────────────────

const PROXY_BASE = "/api/proxy/aniwatch";
const IS_BROWSER = typeof window !== "undefined";

function deriveReferer(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return REFERER;
  }
}

async function proxiedFetch(input: string, init?: RequestInit): Promise<Response> {
  const referer = deriveReferer(input);
  if (IS_BROWSER) {
    const proxyUrl = `${PROXY_BASE}?url=${encodeURIComponent(input)}&ref=${encodeURIComponent(referer)}`;
    return fetch(proxyUrl, init);
  }
  return fetch(input, {
    ...init,
    headers: { ...init?.headers, "User-Agent": USER_AGENT, Referer: referer },
  } as RequestInit);
}

// ── Raw WordPress response schema (internal) ────────────────────────────────

const WpPostRawSchema = z.object({
  id: z.number(),
  date: z.string(),
  slug: z.string(),
  link: z.string(),
  title: z.object({ rendered: z.string() }),
  categories: z.array(z.number()).default([]),
  tags: z.array(z.number()).default([]),
});
type WpPostRaw = z.infer<typeof WpPostRawSchema>;

// ── JW Player source object shape ───────────────────────────────────────────

const JwSourceSchema = z.object({
  file: z.string(),
  label: z.string().optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Maps a raw WordPress post API response to the clean AniwatchEpisode type. */
function mapPost(raw: WpPostRaw): AniwatchEpisode {
  return AniwatchEpisodeSchema.parse({
    id: raw.id,
    date: raw.date,
    slug: raw.slug,
    title: raw.title.rendered,
    link: raw.link,
    categoryIds: raw.categories,
    tags: raw.tags,
  });
}

/**
 * Shared fetch helper for AniwatchTV WordPress REST API requests.
 * Adds User-Agent and Referer headers required by the server.
 * Responses are cached for 5 minutes (Next.js ISR).
 */
async function aniwatchFetch<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await proxiedFetch(url, IS_BROWSER ? undefined : {
    next: { revalidate: 300 },
  } as RequestInit);
  if (!res.ok) {
    throw new Error(
      `AniwatchTV API error: ${res.status} ${res.statusText} for ${path}`,
    );
  }
  return res.json() as Promise<T>;
}

// ── WordPress REST API functions ────────────────────────────────────────────

/**
 * Fetches the latest episodes ordered by publish date descending.
 *
 * @param page    - Page number (default: 1)
 * @param perPage - Episodes per page, max 100 (default: 20)
 */
export async function fetchLatestEpisodes(
  page = 1,
  perPage = 20,
): Promise<AniwatchEpisode[]> {
  const raw = await aniwatchFetch<WpPostRaw[]>(
    `${API_BASE}/posts?page=${page}&per_page=${perPage}&orderby=date&order=desc`,
  );
  return WpPostRawSchema.array().parse(raw).map(mapPost);
}

/**
 * Fetches a single episode by its WordPress post ID.
 *
 * @param postId - The WordPress post ID of the episode
 */
export async function fetchEpisode(postId: number): Promise<AniwatchEpisode> {
  const raw = await aniwatchFetch<WpPostRaw>(`${API_BASE}/posts/${postId}`);
  return mapPost(WpPostRawSchema.parse(raw));
}

/**
 * Fetches all anime categories (series), ordered by episode count descending.
 *
 * @param page    - Page number (default: 1)
 * @param perPage - Categories per page, max 100 (default: 100)
 */
export async function fetchCategories(
  page = 1,
  perPage = 100,
): Promise<AniwatchCategory[]> {
  const raw = await aniwatchFetch<AniwatchCategory[]>(
    `${API_BASE}/categories?page=${page}&per_page=${perPage}&orderby=count&order=desc`,
  );
  return AniwatchCategorySchema.array().parse(raw);
}

/**
 * Fetches all episodes belonging to a specific anime category.
 *
 * @param categoryId - The category ID (anime series)
 * @param perPage    - Episodes per page, max 100 (default: 100)
 */
export async function fetchEpisodesByCategory(
  categoryId: number,
  perPage = 100,
): Promise<AniwatchEpisode[]> {
  const raw = await aniwatchFetch<WpPostRaw[]>(
    `${API_BASE}/posts?categories=${categoryId}&per_page=${perPage}&orderby=date&order=desc`,
  );
  return WpPostRawSchema.array().parse(raw).map(mapPost);
}

/**
 * Searches for episodes matching the given query string.
 *
 * @param query   - Search terms
 * @param perPage - Results per page, max 100 (default: 20)
 */
export async function searchPosts(
  query: string,
  perPage = 20,
): Promise<AniwatchEpisode[]> {
  // `posts?search=` is dead on this WordPress install (always 0 rows), while
  // `categories?search=` works when the term is hyphenated. So resolve the query
  // to candidate series first, then pull their episodes by category id.
  const trimmed = query.trim();
  if (!trimmed) return [];

  const categories = await findCategory(trimmed);
  if (categories.length === 0) return [];

  const needle = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const ranked = [...categories].sort((a, b) => {
    const aSlug = a.slug?.toLowerCase() ?? "";
    const bSlug = b.slug?.toLowerCase() ?? "";
    const aExact = aSlug === needle ? 0 : aSlug.includes(needle) ? 1 : 2;
    const bExact = bSlug === needle ? 0 : bSlug.includes(needle) ? 1 : 2;
    return aExact - bExact || (b.count ?? 0) - (a.count ?? 0);
  });

  const results: AniwatchEpisode[] = [];
  for (const category of ranked.slice(0, 2)) {
    if (results.length >= perPage) break;
    try {
      const episodes = await fetchEpisodesByCategory(category.id, perPage);
      results.push(...episodes);
    } catch {
      /* skip this category */
    }
  }

  return results.slice(0, perPage);
}

/**
 * Finds anime categories matching a name.
 * Useful for resolving an anime name to its category ID.
 *
 * @param animeName - Partial or full anime name to search for
 */
export async function findCategory(
  animeName: string,
): Promise<AniwatchCategory[]> {
  // The WordPress REST search only matches hyphenated slugs: `?search=one punch
  // man` (and `one%20punch%20man`) return zero rows, `one-punch-man` returns hits.
  const query = animeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!query) return [];

  try {
    const raw = await aniwatchFetch<AniwatchCategory[]>(
      `${API_BASE}/categories?search=${encodeURIComponent(query)}&per_page=10`,
    );
    return AniwatchCategorySchema.array().parse(raw);
  } catch {
    return [];
  }
}

// ── Video extraction ────────────────────────────────────────────────────────

/**
 * Extracts the video URL, quality sources, and thumbnail from an episode
 * watch page. Performs three sequential HTTP requests:
 *
 * 1. Fetches the episode page HTML to find the player iframe src.
 * 2. Fetches the player page to access the inline JavaScript configuration.
 * 3. Parses `var fileUrl`, `var sources`, and `var thumbUrl` via regex.
 *
 * @param episodeSlug - The episode slug
 *   (e.g. `"wistoria-wand-and-sword-season-2-episode-12-english-subbed"`)
 */
export async function extractVideoUrl(
  episodeSlug: string,
): Promise<AniwatchVideoSource> {
  const epUrl = `${BASE_URL}/${episodeSlug}/`;

  // Step 1: Fetch episode page HTML
  const epRes = await proxiedFetch(epUrl);
  if (!epRes.ok) {
    throw new Error(
      `Failed to fetch episode page: ${epRes.status} ${epRes.statusText}`,
    );
  }
  const html = await epRes.text();

  // Step 2: Extract iframe src from player container
  const iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/);
  if (!iframeMatch) {
    throw new Error("No video player iframe found on episode page");
  }
  const playerUrl = iframeMatch[1];

  // Step 3: Fetch player page with Referer header
  const playerRes = await proxiedFetch(playerUrl);
  if (!playerRes.ok) {
    throw new Error(
      `Failed to fetch player page: ${playerRes.status} ${playerRes.statusText}`,
    );
  }
  const playerHtml = await playerRes.text();

  // Step 4: Parse inline JS variables via regex
  // Try multiple extraction strategies — different source providers use different formats

  let videoUrl = "";
  let qualities: { label: string; url: string }[] = [];
  let thumbnail: string | null = null;

  // Strategy A: JW Player (source=blogger)
  const jwFileMatch = playerHtml.match(/var fileUrl\s*=\s*"([^"]+)"/);
  if (jwFileMatch) {
    videoUrl = jwFileMatch[1];
    const jwSourcesMatch = playerHtml.match(/var sources\s*=\s*(\[[\s\S]*?\])/);
    if (jwSourcesMatch) {
      try {
        qualities = JwSourceSchema.array()
          .parse(JSON.parse(jwSourcesMatch[1]))
          .map((s) => ({ label: s.label ?? "unknown", url: s.file }));
      } catch { /* ignore */ }
    }
    const jwThumb = playerHtml.match(/var thumbUrl\s*=\s*"([^"]*)"/);
    thumbnail = jwThumb ? jwThumb[1] || null : null;
  }

  // Strategy B: Nested iframe (source=hianime, other embeds)
  if (!videoUrl) {
    const nestedIframeMatch = playerHtml.match(/<iframe[^>]*src="([^"]+)"/);
    if (nestedIframeMatch) {
      const nestedUrl = nestedIframeMatch[1];
      const nestedRes = await proxiedFetch(nestedUrl);
      if (nestedRes.ok) {
        const nestedHtml = await nestedRes.text();
        const nestedFile = nestedHtml.match(/var fileUrl\s*=\s*"([^"]+)"/);
        if (nestedFile) {
          videoUrl = nestedFile[1];
          const nestedSources = nestedHtml.match(/var sources\s*=\s*(\[[\s\S]*?\])/);
          if (nestedSources) {
            try {
              qualities = JwSourceSchema.array()
                .parse(JSON.parse(nestedSources[1]))
                .map((s) => ({ label: s.label ?? "unknown", url: s.file }));
            } catch { /* ignore */ }
          }
          const nestedThumb = nestedHtml.match(/var thumbUrl\s*=\s*"([^"]*)"/);
          if (nestedThumb) thumbnail = nestedThumb[1] || null;
        }
        // Also try: direct video source tags in nested page
        if (!videoUrl) {
          const vidSrc = nestedHtml.match(/<source[^>]*src="([^"]+\.mp4[^"]*)"/)
            ?? nestedHtml.match(/src="(https?:\/\/[^"]*googlevideo\.com[^"]*)"/);
          if (vidSrc) videoUrl = vidSrc[1];
        }
      }
    }
  }

  // Strategy C: Direct video/source tags in the player page
  if (!videoUrl) {
    const vidSrc = playerHtml.match(/<source[^>]*src="([^"]+\.mp4[^"]*)"/)
      ?? playerHtml.match(/src="(https?:\/\/[^"]*googlevideo\.com[^"]*)"/)
      ?? playerHtml.match(/src="(https?:\/\/[^"]*\.mp4[^"]*)"/);
    if (vidSrc) videoUrl = vidSrc[1];
  }

  // Strategy D: Any URL that looks like a video CDN in the JS
  if (!videoUrl) {
    const anyVideoUrl = playerHtml.match(/"(https?:\/\/[^"]*\.googlevideo\.com\/videoplayback[^"]*)"/)
      ?? playerHtml.match(/"(https?:\/\/[^"]*\/videoplayback[^"]*)"/);
    if (anyVideoUrl) videoUrl = anyVideoUrl[1];
  }

  if (!videoUrl) {
    throw new Error("Could not extract video URL — unsupported video source format");
  }

  return AniwatchVideoSourceSchema.parse({
    videoUrl,
    qualities,
    thumbnail,
    playerPageUrl: playerUrl,
  });
}
