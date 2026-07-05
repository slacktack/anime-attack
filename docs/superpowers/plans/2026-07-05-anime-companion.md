# Anime Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first responsive anime discovery website with a Gemini-powered, spoiler-aware AI companion, using free AniList/Jikan data and browser-local persistence.

**Architecture:** Next.js App Router with a thin server-side API layer. Server routes proxy AniList (cached) and Gemini (key server-only). A typed `lib/anime` data module and `lib/storage` browser module keep screens clean. Premium visuals (3D tilt cards, WebGL hero) sit in `components/ui` behind performance/reduced-motion guardrails.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, Tailwind CSS, Framer Motion, TanStack Query, Embla Carousel, react-three-fiber + drei, Vitest + Testing Library, Zod.

## Global Constraints

- Language: TypeScript, `strict: true`. No `any` in committed code (use `unknown` + narrowing).
- Node 20+. Package manager: npm.
- Gemini key is read ONLY server-side from `process.env.GEMINI_API_KEY`. Never import it in a client component or expose via `NEXT_PUBLIC_`.
- No video streaming, no auth, no database in this plan (v1 scope).
- Colors: base `#080808` / `#121212` / `#1C1C1C`; accents purple `#7C3AED`, blue `#3B82F6`, crimson `#DC2626`, gold `#F59E0B`.
- All animation must respect `prefers-reduced-motion`. Animate transform/opacity only.
- Test runner: `npx vitest run`. Tests live in `*.test.ts(x)` next to source.
- Commit after every task with a `feat:`/`test:`/`chore:` prefix.

---

### Task 1: Scaffold Next.js app + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `.env.local.example`

**Interfaces:**
- Produces: a running dev server (`npm run dev`) and passing test command (`npx vitest run`).

- [ ] **Step 1: Scaffold**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack --yes
npm i @tanstack/react-query framer-motion embla-carousel-react three @react-three/fiber @react-three/drei zod
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add color tokens + env example**

In `tailwind.config.ts`, extend theme colors:

```ts
theme: { extend: { colors: {
  ink: { 900: "#080808", 800: "#121212", 700: "#1C1C1C" },
  accent: { purple: "#7C3AED", blue: "#3B82F6", crimson: "#DC2626", gold: "#F59E0B" },
} } }
```

Create `.env.local.example`:

```
GEMINI_API_KEY=your_key_here
```

- [ ] **Step 4: Smoke test**

Create `app/smoke.test.ts`:

```ts
import { expect, test } from "vitest";
test("env wiring", () => { expect(1 + 1).toBe(2); });
```

Run: `npx vitest run` → Expected: PASS. Run: `npm run build` → Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with tailwind, vitest, deps"
```

---

### Task 2: Domain types + Zod schemas

**Files:**
- Create: `lib/anime/types.ts`
- Test: `lib/anime/types.test.ts`

**Interfaces:**
- Produces: `Anime`, `AnimeSummary`, `Character`, `Episode`, `AnimeType`, `AnimeStatus` types and matching Zod schemas `AnimeSchema`, `AnimeSummarySchema`, `CharacterSchema`, `EpisodeSchema`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { AnimeSummarySchema } from "./types";

test("AnimeSummarySchema parses a valid summary", () => {
  const parsed = AnimeSummarySchema.parse({
    id: 1, title: "Black Clover", cover: "http://x/y.jpg",
    banner: null, type: "TV", score: 7.29, year: 2017,
  });
  expect(parsed.title).toBe("Black Clover");
});

test("AnimeSummarySchema rejects missing id", () => {
  expect(() => AnimeSummarySchema.parse({ title: "x" })).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/anime/types.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { z } from "zod";

export const AnimeTypeSchema = z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"]);
export type AnimeType = z.infer<typeof AnimeTypeSchema>;

export const AnimeStatusSchema = z.enum(["RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]);
export type AnimeStatus = z.infer<typeof AnimeStatusSchema>;

export const AnimeSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  cover: z.string(),
  banner: z.string().nullable(),
  type: AnimeTypeSchema.nullable().default(null),
  score: z.number().nullable().default(null),
  year: z.number().nullable().default(null),
});
export type AnimeSummary = z.infer<typeof AnimeSummarySchema>;

export const CharacterSchema = z.object({
  id: z.number(),
  name: z.string(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  voiceActor: z.string().nullable().default(null),
});
export type Character = z.infer<typeof CharacterSchema>;

export const EpisodeSchema = z.object({
  number: z.number(),
  title: z.string().nullable(),
  filler: z.boolean().default(false),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const AnimeSchema = AnimeSummarySchema.extend({
  bannerImage: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  genres: z.array(z.string()).default([]),
  status: AnimeStatusSchema.nullable().default(null),
  episodes: z.number().nullable().default(null),
  studios: z.array(z.string()).default([]),
});
export type Anime = z.infer<typeof AnimeSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/anime/types.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/anime/types.ts lib/anime/types.test.ts && git commit -m "feat: add anime domain types and zod schemas"
```

---

### Task 3: AniList mappers (raw GraphQL → domain)

**Files:**
- Create: `lib/anime/anilist-map.ts`
- Test: `lib/anime/anilist-map.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces: `mapMediaToSummary(media: unknown): AnimeSummary`, `mapMediaToAnime(media: unknown): Anime`, `mapCharacterEdge(edge: unknown): Character`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { mapMediaToSummary, mapMediaToAnime } from "./anilist-map";

const media = {
  id: 100, title: { english: "Black Clover", romaji: "Black Clover" },
  coverImage: { large: "http://x/cover.jpg" }, bannerImage: "http://x/banner.jpg",
  format: "TV", averageScore: 73, seasonYear: 2017,
  description: "Asta...", genres: ["Action"], status: "FINISHED", episodes: 170,
  studios: { nodes: [{ name: "Pierrot" }] },
};

test("maps summary, score scaled to 10", () => {
  const s = mapMediaToSummary(media);
  expect(s.title).toBe("Black Clover");
  expect(s.score).toBe(7.3);
  expect(s.type).toBe("TV");
});

test("maps full anime with genres and studios", () => {
  const a = mapMediaToAnime(media);
  expect(a.genres).toEqual(["Action"]);
  expect(a.studios).toEqual(["Pierrot"]);
  expect(a.episodes).toBe(170);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/anime/anilist-map.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { Anime, AnimeSchema, AnimeSummary, AnimeSummarySchema, Character, CharacterSchema } from "./types";

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
  return AnimeSchema.parse({
    ...mapMediaToSummary(media),
    bannerImage: m?.bannerImage ?? null,
    description: m?.description ?? null,
    genres: Array.isArray(m?.genres) ? m.genres : [],
    status: m?.status ?? null,
    episodes: typeof m?.episodes === "number" ? m.episodes : null,
    studios: Array.isArray(m?.studios?.nodes) ? m.studios.nodes.map((n: Rec) => n.name) : [],
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/anime/anilist-map.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/anime/anilist-map.ts lib/anime/anilist-map.test.ts && git commit -m "feat: add AniList response mappers"
```

---

### Task 4: AniList GraphQL client + queries

**Files:**
- Create: `lib/anime/anilist.ts`
- Create: `lib/anime/queries.ts`
- Test: `lib/anime/anilist.test.ts`

**Interfaces:**
- Consumes: mappers (Task 3).
- Produces: `anilistFetch<T>(query: string, variables?: Rec): Promise<T>`; query functions `getTrending()`, `getTopAiring()`, `getPopularMovies()`, `searchAnime(term, page?)`, `getAnimeDetails(id)`, `getCharacters(id)`, `getRecommendations(id)` — all returning domain types. Uses global `fetch`.

- [ ] **Step 1: Write the failing test** (mock `fetch`)

```ts
import { afterEach, expect, test, vi } from "vitest";
import { getTrending } from "./anilist";

afterEach(() => vi.restoreAllMocks());

test("getTrending maps media list", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    data: { Page: { media: [{ id: 1, title: { english: "X" }, coverImage: { large: "c" }, format: "TV", averageScore: 80 }] } },
  }), { status: 200 })));
  const res = await getTrending();
  expect(res[0].title).toBe("X");
  expect(res[0].score).toBe(8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/anime/anilist.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `queries.ts`** (GraphQL strings)

```ts
const MEDIA_FIELDS = `
  id title { english romaji native } coverImage { large medium }
  bannerImage format averageScore seasonYear episodes status genres
  studios(isMain: true) { nodes { name } }`;

export const TRENDING = `query { Page(perPage: 20) { media(sort: TRENDING_DESC, type: ANIME) { ${MEDIA_FIELDS} } } }`;
export const TOP_AIRING = `query { Page(perPage: 20) { media(status: RELEASING, sort: POPULARITY_DESC, type: ANIME) { ${MEDIA_FIELDS} } } }`;
export const POPULAR_MOVIES = `query { Page(perPage: 20) { media(format: MOVIE, sort: POPULARITY_DESC, type: ANIME) { ${MEDIA_FIELDS} } } }`;
export const SEARCH = `query ($q: String, $page: Int) { Page(page: $page, perPage: 20) { media(search: $q, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} } } }`;
export const DETAILS = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} description(asHtml: false) } }`;
export const CHARACTERS = `query ($id: Int) { Media(id: $id, type: ANIME) { characters(sort: ROLE, perPage: 25) { edges { role node { id name { full native } image { large } } voiceActors(language: JAPANESE) { name { full } } } } } }`;
export const RECOMMENDATIONS = `query ($id: Int) { Media(id: $id, type: ANIME) { recommendations(sort: RATING_DESC, perPage: 20) { nodes { mediaRecommendation { ${MEDIA_FIELDS} } } } } }`;
```

- [ ] **Step 4: Implement `anilist.ts`**

```ts
import { mapCharacterEdge, mapMediaToAnime, mapMediaToSummary } from "./anilist-map";
import * as Q from "./queries";
import type { Anime, AnimeSummary, Character } from "./types";

const ENDPOINT = "https://graphql.anilist.co";
type Rec = Record<string, any>;

export async function anilistFetch<T>(query: string, variables: Rec = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  } as RequestInit);
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = (await res.json()) as { data: T; errors?: unknown };
  if (json.errors) throw new Error("AniList query error");
  return json.data;
}

const listFrom = (d: Rec): AnimeSummary[] => (d?.Page?.media ?? []).map(mapMediaToSummary);

export const getTrending = () => anilistFetch<Rec>(Q.TRENDING).then(listFrom);
export const getTopAiring = () => anilistFetch<Rec>(Q.TOP_AIRING).then(listFrom);
export const getPopularMovies = () => anilistFetch<Rec>(Q.POPULAR_MOVIES).then(listFrom);
export const searchAnime = (q: string, page = 1) =>
  anilistFetch<Rec>(Q.SEARCH, { q, page }).then(listFrom);
export const getAnimeDetails = (id: number): Promise<Anime> =>
  anilistFetch<Rec>(Q.DETAILS, { id }).then((d) => mapMediaToAnime(d.Media));
export const getCharacters = (id: number): Promise<Character[]> =>
  anilistFetch<Rec>(Q.CHARACTERS, { id }).then((d) => (d?.Media?.characters?.edges ?? []).map(mapCharacterEdge));
export const getRecommendations = (id: number): Promise<AnimeSummary[]> =>
  anilistFetch<Rec>(Q.RECOMMENDATIONS, { id }).then((d) =>
    (d?.Media?.recommendations?.nodes ?? [])
      .map((n: Rec) => n.mediaRecommendation).filter(Boolean).map(mapMediaToSummary));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/anime/anilist.test.ts` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/anime/ && git commit -m "feat: add AniList client and query functions"
```

---

### Task 5: Jikan episodes + filler classification

**Files:**
- Create: `lib/anime/jikan.ts`
- Test: `lib/anime/jikan.test.ts`

**Interfaces:**
- Consumes: `Episode` type (Task 2).
- Produces: `getEpisodesByMal(malId: number): Promise<Episode[]>`. Returns `[]` on any failure (episodes are best-effort). Note: AniList `Media` also exposes `idMal`; detail queries will include it in a later task if needed — for now this takes a MAL id directly.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, test, vi } from "vitest";
import { getEpisodesByMal } from "./jikan";

afterEach(() => vi.restoreAllMocks());

test("maps jikan episodes with filler flag", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    data: [{ mal_id: 1, title: "Asta and Yuno", filler: false }, { mal_id: 2, title: "Filler ep", filler: true }],
    pagination: { has_next_page: false },
  }), { status: 200 })));
  const eps = await getEpisodesByMal(30);
  expect(eps).toHaveLength(2);
  expect(eps[1].filler).toBe(true);
});

test("returns [] on fetch failure", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
  expect(await getEpisodesByMal(30)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/anime/jikan.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { Episode, EpisodeSchema } from "./types";

type Rec = Record<string, any>;

export async function getEpisodesByMal(malId: number): Promise<Episode[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes`, {
      headers: { Accept: "application/json" }, next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Rec[] };
    return (json.data ?? []).map((e, i) =>
      EpisodeSchema.parse({ number: e.mal_id ?? i + 1, title: e.title ?? null, filler: Boolean(e.filler) }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/anime/jikan.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/anime/jikan.ts lib/anime/jikan.test.ts && git commit -m "feat: add Jikan episodes with filler classification"
```

---

### Task 6: Browser storage layer (progress, favorites, spoiler ceiling)

**Files:**
- Create: `lib/storage/store.ts`
- Test: `lib/storage/store.test.ts`

**Interfaces:**
- Produces:
  - `getSpoilerCeiling(animeId: number): number` (0 if unset)
  - `setSpoilerCeiling(animeId: number, episode: number): void`
  - `toggleFavorite(item: AnimeSummary): boolean` (returns new state)
  - `isFavorite(animeId: number): boolean`
  - `getFavorites(): AnimeSummary[]`
  - `recordProgress(item: AnimeSummary, episode: number): void`
  - `getContinueWatching(): Array<{ anime: AnimeSummary; episode: number; at: number }>`
- All are safe when `window`/`localStorage` is undefined (SSR) → read-ops return empty defaults, write-ops no-op.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, expect, test } from "vitest";
import { getSpoilerCeiling, setSpoilerCeiling, toggleFavorite, isFavorite, recordProgress, getContinueWatching } from "./store";

const item = { id: 1, title: "Black Clover", cover: "c", banner: null, type: "TV", score: 7.3, year: 2017 };

beforeEach(() => localStorage.clear());

test("spoiler ceiling defaults to 0 and persists", () => {
  expect(getSpoilerCeiling(1)).toBe(0);
  setSpoilerCeiling(1, 41);
  expect(getSpoilerCeiling(1)).toBe(41);
});

test("toggle favorite flips state", () => {
  expect(toggleFavorite(item)).toBe(true);
  expect(isFavorite(1)).toBe(true);
  expect(toggleFavorite(item)).toBe(false);
  expect(isFavorite(1)).toBe(false);
});

test("continue watching sorts most-recent first", () => {
  recordProgress(item, 5);
  recordProgress({ ...item, id: 2, title: "B" }, 3);
  const cw = getContinueWatching();
  expect(cw[0].anime.id).toBe(2);
  expect(cw[0].episode).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/storage/store.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { AnimeSummary } from "@/lib/anime/types";

const NS = "animecomp.v1";
const key = (k: string) => `${NS}.${k}`;

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key(k));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write(k: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key(k), JSON.stringify(value)); } catch { /* quota */ }
}

export function getSpoilerCeiling(animeId: number): number {
  return read<Record<string, number>>("ceiling", {})[String(animeId)] ?? 0;
}
export function setSpoilerCeiling(animeId: number, episode: number): void {
  const map = read<Record<string, number>>("ceiling", {});
  map[String(animeId)] = Math.max(0, Math.floor(episode));
  write("ceiling", map);
}

export function getFavorites(): AnimeSummary[] {
  return read<AnimeSummary[]>("favorites", []);
}
export function isFavorite(animeId: number): boolean {
  return getFavorites().some((f) => f.id === animeId);
}
export function toggleFavorite(item: AnimeSummary): boolean {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.id === item.id);
  if (idx >= 0) { list.splice(idx, 1); write("favorites", list); return false; }
  list.unshift(item); write("favorites", list); return true;
}

type Progress = { anime: AnimeSummary; episode: number; at: number };
export function recordProgress(item: AnimeSummary, episode: number): void {
  const list = read<Progress[]>("progress", []).filter((p) => p.anime.id !== item.id);
  list.push({ anime: item, episode, at: nowMonotonic(list) });
  write("progress", list);
}
export function getContinueWatching(): Progress[] {
  return read<Progress[]>("progress", []).slice().sort((a, b) => b.at - a.at);
}

// Avoid Date.now() flakiness in tests: monotonic counter derived from existing entries.
function nowMonotonic(existing: Progress[]): number {
  const max = existing.reduce((m, p) => Math.max(m, p.at), 0);
  return max + 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/storage/store.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/ && git commit -m "feat: add browser storage for progress, favorites, spoiler ceiling"
```

---

### Task 7: Gemini prompt builder with spoiler ceiling

**Files:**
- Create: `lib/ai/prompts.ts`
- Test: `lib/ai/prompts.test.ts`

**Interfaces:**
- Produces:
  - `type AiTask = "summary" | "catchup" | "chat" | "character" | "recommend"`
  - `buildPrompt(input: { task: AiTask; animeTitle: string; ceiling: number; context?: string; question?: string; characterName?: string }): { system: string; user: string }`
- The system prompt MUST include a hard spoiler rule referencing the ceiling. When `ceiling` is 0, treat as "no episodes watched — only setup-level, spoiler-free info."

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { buildPrompt } from "./prompts";

test("summary prompt embeds spoiler ceiling", () => {
  const { system, user } = buildPrompt({ task: "summary", animeTitle: "Black Clover", ceiling: 41 });
  expect(system).toMatch(/episode 41/i);
  expect(system).toMatch(/do not reveal/i);
  expect(user).toMatch(/Black Clover/);
});

test("ceiling 0 means spoiler-free setup only", () => {
  const { system } = buildPrompt({ task: "chat", animeTitle: "X", ceiling: 0, question: "who wins?" });
  expect(system).toMatch(/no episodes/i);
});

test("chat prompt includes the question", () => {
  const { user } = buildPrompt({ task: "chat", animeTitle: "X", ceiling: 5, question: "Who is Yami?" });
  expect(user).toMatch(/Who is Yami\?/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/prompts.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export type AiTask = "summary" | "catchup" | "chat" | "character" | "recommend";

interface PromptInput {
  task: AiTask;
  animeTitle: string;
  ceiling: number;
  context?: string;
  question?: string;
  characterName?: string;
}

function spoilerRule(ceiling: number): string {
  if (ceiling <= 0) {
    return "The viewer has watched NO episodes yet. Only give setup/premise-level, entirely spoiler-free information. Do not reveal any plot developments.";
  }
  return `The viewer has watched up to and including episode ${ceiling}. You must NOT reveal, hint at, or reference ANY event, twist, death, power-up, or character development that occurs after episode ${ceiling}. If answering fully would require later content, say it is beyond their current progress and offer a spoiler-free alternative.`;
}

export function buildPrompt(input: PromptInput): { system: string; user: string } {
  const { task, animeTitle, ceiling, context, question, characterName } = input;
  const system = [
    `You are an expert, spoiler-aware anime companion for "${animeTitle}".`,
    spoilerRule(ceiling),
    "Be concise, warm, and specific. Use plain language. Never invent facts.",
    context ? `Reference context:\n${context}` : "",
  ].filter(Boolean).join("\n\n");

  const user = ((): string => {
    switch (task) {
      case "summary": return `Give a 1-line hook, then a short spoiler-safe summary of "${animeTitle}".`;
      case "catchup": return `Recap the story of "${animeTitle}" so far, so I can jump back in.`;
      case "chat": return question ?? "Tell me something interesting.";
      case "character": return `Explain the character ${characterName ?? "(unknown)"} from "${animeTitle}": who they are, their role, powers, and key relationships.`;
      case "recommend": return `Recommend 5 anime I'd like based on "${animeTitle}", each with a one-line reason.`;
    }
  })();

  return { system, user };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/prompts.test.ts` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/prompts.ts lib/ai/prompts.test.ts && git commit -m "feat: add spoiler-aware Gemini prompt builder"
```

---

### Task 8: Gemini API route

**Files:**
- Create: `lib/ai/gemini.ts`
- Create: `app/api/ai/route.ts`
- Test: `lib/ai/gemini.test.ts`

**Interfaces:**
- Consumes: `buildPrompt` (Task 7).
- Produces:
  - `callGemini(system: string, user: string): Promise<string>` (server-only; reads `GEMINI_API_KEY`).
  - `POST /api/ai` accepting JSON `{ task, animeTitle, ceiling, question?, characterName?, context? }`, returning `{ text: string }`. Validates body with a Zod schema; 400 on invalid, 500 on Gemini failure.

- [ ] **Step 1: Write the failing test** (`callGemini` with mocked fetch)

```ts
import { afterEach, expect, test, vi } from "vitest";
import { callGemini } from "./gemini";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

test("callGemini returns concatenated text", async () => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "Hello" }, { text: " world" }] } }],
  }), { status: 200 })));
  expect(await callGemini("sys", "hi")).toBe("Hello world");
});

test("callGemini throws without key", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  await expect(callGemini("s", "u")).rejects.toThrow(/GEMINI_API_KEY/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/gemini.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement `lib/ai/gemini.ts`**

```ts
const MODEL = "gemini-2.5-flash";
type Rec = Record<string, any>;

export async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = (await res.json()) as Rec;
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: Rec) => p.text ?? "").join("").trim();
}
```

- [ ] **Step 4: Implement `app/api/ai/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPrompt } from "@/lib/ai/prompts";
import { callGemini } from "@/lib/ai/gemini";

export const runtime = "nodejs";

const BodySchema = z.object({
  task: z.enum(["summary", "catchup", "chat", "character", "recommend"]),
  animeTitle: z.string().min(1),
  ceiling: z.number().int().nonnegative(),
  question: z.string().optional(),
  characterName: z.string().optional(),
  context: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  try {
    const { system, user } = buildPrompt(parsed.data);
    const text = await callGemini(system, user);
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "ai failed" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run test + build**

Run: `npx vitest run lib/ai/gemini.test.ts` → Expected: PASS. Run: `npm run build` → Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/gemini.ts app/api/ai/route.ts lib/ai/gemini.test.ts && git commit -m "feat: add Gemini call helper and /api/ai route"
```

---

### Task 9: App shell — providers, bottom nav, theme

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/providers.tsx`
- Create: `components/ui/BottomNav.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<Providers>` wrapping the app in a `QueryClientProvider`; a fixed bottom navigation (Home / Search / Library) visible on mobile and desktop.

- [ ] **Step 1: Implement `app/providers.tsx`**

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 300_000, refetchOnWindowFocus: false } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Implement `components/ui/BottomNav.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/library", label: "Library", icon: "📚" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/5 bg-ink-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors ${active ? "text-accent-purple" : "text-white/50"}`}>
              <span className="text-lg">{it.icon}</span>{it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Wire `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/ui/BottomNav";

export const metadata: Metadata = { title: "Anime Companion", description: "The smartest anime companion." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-white antialiased pb-20">
        <Providers>{children}</Providers>
        <BottomNav />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Add base styles to `app/globals.css`** (append)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
::-webkit-scrollbar { display: none; }
body { -webkit-tap-highlight-color: transparent; }
```

- [ ] **Step 5: Verify**

Run: `npm run build` → Expected: succeeds. Manual: `npm run dev`, confirm bottom nav renders and highlights active route on mobile viewport (DevTools device toolbar).

- [ ] **Step 6: Commit**

```bash
git add app/ components/ui/BottomNav.tsx && git commit -m "feat: add app shell with providers and bottom nav"
```

---

### Task 10: Card3D + PosterCard (tilt with guardrails)

**Files:**
- Create: `lib/ui/useReducedMotion.ts`
- Create: `components/ui/Card3D.tsx`
- Create: `components/ui/PosterCard.tsx`
- Test: `components/ui/PosterCard.test.tsx`

**Interfaces:**
- Consumes: `AnimeSummary` (Task 2).
- Produces:
  - `useReducedMotion(): boolean`
  - `<Card3D>` — wrapper adding pointer-driven tilt via Framer Motion; NO tilt when reduced motion.
  - `<PosterCard anime={...} />` — links to `/anime/[id]`, shows cover + title + score, wrapped in Card3D.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PosterCard } from "./PosterCard";

test("PosterCard renders title and links to detail", () => {
  render(<PosterCard anime={{ id: 42, title: "Bleach", cover: "c", banner: null, type: "TV", score: 8.1, year: 2004 }} />);
  expect(screen.getByText("Bleach")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/anime/42");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/PosterCard.test.tsx` → Expected: FAIL.

- [ ] **Step 3: Implement `lib/ui/useReducedMotion.ts`**

```ts
"use client";
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
```

- [ ] **Step 4: Implement `components/ui/Card3D.tsx`**

```tsx
"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";
import type { PointerEvent, ReactNode } from "react";

export function Card3D({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 15 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 15 });

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() { x.set(0); y.set(0); }

  return (
    <motion.div
      onPointerMove={onMove} onPointerLeave={reset}
      style={reduced ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 800 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 5: Implement `components/ui/PosterCard.tsx`**

```tsx
import Link from "next/link";
import type { AnimeSummary } from "@/lib/anime/types";
import { Card3D } from "./Card3D";

export function PosterCard({ anime }: { anime: AnimeSummary }) {
  return (
    <Link href={`/anime/${anime.id}`} className="block w-32 shrink-0 sm:w-40">
      <Card3D className="group relative overflow-hidden rounded-2xl bg-ink-700 shadow-lg shadow-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={anime.cover} alt={anime.title} loading="lazy"
          className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
          <p className="line-clamp-2 text-xs font-semibold">{anime.title}</p>
          {anime.score != null && <p className="text-[10px] text-accent-gold">★ {anime.score}</p>}
        </div>
      </Card3D>
    </Link>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run components/ui/PosterCard.test.tsx` → Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/ui/ components/ui/Card3D.tsx components/ui/PosterCard.tsx components/ui/PosterCard.test.tsx && git commit -m "feat: add Card3D tilt wrapper and PosterCard"
```

---

### Task 11: Carousel + Home page

**Files:**
- Create: `components/ui/Carousel.tsx`
- Create: `components/screens/HomeCarousels.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `PosterCard` (Task 10), AniList queries (Task 4), `getContinueWatching` (Task 6).
- Produces: `<Carousel title>` (Embla horizontal row), `<HomeCarousels>` client component fetching rows via TanStack Query; `app/page.tsx` server component renders greeting + `<HomeCarousels>`.

- [ ] **Step 1: Implement `components/ui/Carousel.tsx`**

```tsx
"use client";
import useEmblaCarousel from "embla-carousel-react";
import type { ReactNode } from "react";

export function Carousel({ title, children }: { title: string; children: ReactNode }) {
  const [ref] = useEmblaCarousel({ dragFree: true, align: "start" });
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-4 text-lg font-bold tracking-tight">{title}</h2>
      <div ref={ref} className="overflow-hidden">
        <div className="flex gap-3 px-4">{children}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `components/screens/HomeCarousels.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTrending, getTopAiring, getPopularMovies } from "@/lib/anime/anilist";
import { getContinueWatching } from "@/lib/storage/store";
import { Carousel } from "@/components/ui/Carousel";
import { PosterCard } from "@/components/ui/PosterCard";
import type { AnimeSummary } from "@/lib/anime/types";

function Row({ title, queryKey, fn }: { title: string; queryKey: string; fn: () => Promise<AnimeSummary[]> }) {
  const { data } = useQuery({ queryKey: [queryKey], queryFn: fn });
  if (!data?.length) return null;
  return <Carousel title={title}>{data.map((a) => <PosterCard key={a.id} anime={a} />)}</Carousel>;
}

export function HomeCarousels() {
  const [cw, setCw] = useState<AnimeSummary[]>([]);
  useEffect(() => setCw(getContinueWatching().map((p) => p.anime)), []);
  return (
    <>
      {cw.length > 0 && <Carousel title="Continue Watching">{cw.map((a) => <PosterCard key={a.id} anime={a} />)}</Carousel>}
      <Row title="Trending Today" queryKey="trending" fn={getTrending} />
      <Row title="Top Airing" queryKey="airing" fn={getTopAiring} />
      <Row title="Popular Movies" queryKey="movies" fn={getPopularMovies} />
    </>
  );
}
```

- [ ] **Step 3: Implement `app/page.tsx`**

```tsx
import { HomeCarousels } from "@/components/screens/HomeCarousels";

export default function HomePage() {
  return (
    <main className="pt-8">
      <header className="mb-6 px-4">
        <p className="text-sm text-white/50">Good Evening 👋</p>
        <h1 className="text-2xl font-black tracking-tight">Anime Companion</h1>
      </header>
      <HomeCarousels />
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build` → Expected: succeeds. Manual: `npm run dev`, confirm carousels load real AniList posters and drag horizontally on mobile viewport.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Carousel.tsx components/screens/HomeCarousels.tsx app/page.tsx && git commit -m "feat: add carousel and home page with live AniList rows"
```

---

### Task 12: Search page with instant type-ahead

**Files:**
- Create: `lib/ui/useDebounce.ts`
- Create: `app/search/page.tsx`
- Create: `components/screens/SearchView.tsx`
- Test: `lib/ui/useDebounce.test.ts`

**Interfaces:**
- Consumes: `searchAnime` (Task 4), `PosterCard` (Task 10).
- Produces: `useDebounce<T>(value: T, ms: number): T`; a `/search` page with an input that queries as you type (debounced 250ms) and renders a responsive grid of results.

- [ ] **Step 1: Write the failing test**

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useDebounce } from "./useDebounce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("debounces value updates", () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), { initialProps: { v: "a" } });
  rerender({ v: "ab" });
  expect(result.current).toBe("a");
  act(() => vi.advanceTimersByTime(250));
  expect(result.current).toBe("ab");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/useDebounce.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement `lib/ui/useDebounce.ts`**

```ts
"use client";
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
```

- [ ] **Step 4: Implement `components/screens/SearchView.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchAnime } from "@/lib/anime/anilist";
import { useDebounce } from "@/lib/ui/useDebounce";
import { PosterCard } from "@/components/ui/PosterCard";

export function SearchView() {
  const [term, setTerm] = useState("");
  const q = useDebounce(term, 250);
  const { data, isFetching } = useQuery({
    queryKey: ["search", q], queryFn: () => searchAnime(q), enabled: q.trim().length > 1,
  });
  return (
    <div className="px-4 pt-8">
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search anime…" autoFocus
        className="w-full rounded-2xl border border-white/10 bg-ink-800 px-4 py-3 text-base outline-none focus:border-accent-purple" />
      {isFetching && <p className="mt-4 text-sm text-white/40">Searching…</p>}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {data?.map((a) => <PosterCard key={a.id} anime={a} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `app/search/page.tsx`**

```tsx
import { SearchView } from "@/components/screens/SearchView";
export default function SearchPage() { return <main><SearchView /></main>; }
```

- [ ] **Step 6: Run test + verify**

Run: `npx vitest run lib/ui/useDebounce.test.ts` → Expected: PASS. Run: `npm run build` → succeeds. Manual: typing "bla" shows Black Clover etc.

- [ ] **Step 7: Commit**

```bash
git add lib/ui/useDebounce.ts lib/ui/useDebounce.test.ts app/search/ components/screens/SearchView.tsx && git commit -m "feat: add search page with instant type-ahead"
```

---

### Task 13: WebGL HeroBackdrop (lazy, guarded)

**Files:**
- Create: `components/ui/HeroBackdrop.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` (Task 10).
- Produces: `<HeroBackdrop tint?: string />` — a lazy-loaded react-three-fiber canvas rendering a slow animated gradient/particle field. Renders a plain CSS gradient fallback when reduced motion OR when WebGL/low-end is detected. Never blocks first paint (dynamic import, `ssr: false`).

- [ ] **Step 1: Implement the WebGL scene `components/ui/HeroScene.tsx`**

```tsx
"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

function Blob({ tint }: { tint: string }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = state.clock.elapsedTime * 0.05;
    ref.current.rotation.x = state.clock.elapsedTime * 0.03;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[2.2, 6]} />
      <meshStandardMaterial color={tint} wireframe opacity={0.25} transparent />
    </mesh>
  );
}

export default function HeroScene({ tint }: { tint: string }) {
  return (
    <Canvas camera={{ position: [0, 0, 5] }} dpr={[1, 1.5]} gl={{ antialias: false }}>
      <ambientLight intensity={0.8} />
      <pointLight position={[5, 5, 5]} />
      <Blob tint={tint} />
    </Canvas>
  );
}
```

- [ ] **Step 2: Implement `components/ui/HeroBackdrop.tsx`**

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export function HeroBackdrop({ tint = "#7C3AED" }: { tint?: string }) {
  const reduced = useReducedMotion();
  const [enable, setEnable] = useState(false);
  useEffect(() => {
    const lowEnd = (navigator.hardwareConcurrency ?? 4) <= 2;
    setEnable(!reduced && !lowEnd && webglOk());
  }, [reduced]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${tint}55, transparent 60%)` }} />
      {enable && <div className="absolute inset-0 opacity-70"><HeroScene tint={tint} /></div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build` → Expected: succeeds. Manual: hero gradient shows always; WebGL blob appears on desktop, and is skipped with reduced-motion enabled (DevTools → Rendering → Emulate `prefers-reduced-motion`).

- [ ] **Step 4: Commit**

```bash
git add components/ui/HeroScene.tsx components/ui/HeroBackdrop.tsx && git commit -m "feat: add lazy guarded WebGL hero backdrop"
```

---

### Task 14: Anime detail page (hero, actions, characters, episodes)

**Files:**
- Create: `app/anime/[id]/page.tsx`
- Create: `components/screens/AnimeDetail.tsx`
- Create: `components/ui/FavoriteButton.tsx`
- Create: `components/ui/ProgressControl.tsx`

**Interfaces:**
- Consumes: `getAnimeDetails`, `getCharacters`, `getRecommendations` (Task 4), storage (Task 6), `HeroBackdrop` (Task 13), `Carousel`/`PosterCard` (Tasks 10-11), AI panel (added in Task 15 — a placeholder slot is fine here and filled in Task 15).
- Produces: `/anime/[id]` route rendering full detail; `<FavoriteButton anime />`, `<ProgressControl anime />` (sets spoiler ceiling).

- [ ] **Step 1: Implement `components/ui/FavoriteButton.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/storage/store";
import type { AnimeSummary } from "@/lib/anime/types";

export function FavoriteButton({ anime }: { anime: AnimeSummary }) {
  const [fav, setFav] = useState(false);
  useEffect(() => setFav(isFavorite(anime.id)), [anime.id]);
  return (
    <button onClick={() => setFav(toggleFavorite(anime))}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${fav ? "bg-accent-crimson text-white" : "bg-white/10 text-white"}`}>
      {fav ? "❤️ Favorited" : "🤍 Favorite"}
    </button>
  );
}
```

- [ ] **Step 2: Implement `components/ui/ProgressControl.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { getSpoilerCeiling, setSpoilerCeiling, recordProgress } from "@/lib/storage/store";
import type { AnimeSummary } from "@/lib/anime/types";

export function ProgressControl({ anime, maxEpisodes }: { anime: AnimeSummary; maxEpisodes: number | null }) {
  const [ep, setEp] = useState(0);
  useEffect(() => setEp(getSpoilerCeiling(anime.id)), [anime.id]);
  function update(next: number) {
    const clamped = Math.max(0, maxEpisodes ? Math.min(next, maxEpisodes) : next);
    setEp(clamped); setSpoilerCeiling(anime.id, clamped); recordProgress(anime, clamped);
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ink-800 px-4 py-3">
      <span className="text-sm text-white/60">I'm on episode</span>
      <button onClick={() => update(ep - 1)} className="h-8 w-8 rounded-full bg-white/10">−</button>
      <span className="w-8 text-center font-bold">{ep}</span>
      <button onClick={() => update(ep + 1)} className="h-8 w-8 rounded-full bg-accent-purple">+</button>
    </div>
  );
}
```

- [ ] **Step 3: Implement `components/screens/AnimeDetail.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { getAnimeDetails, getCharacters, getRecommendations } from "@/lib/anime/anilist";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { Carousel } from "@/components/ui/Carousel";
import { PosterCard } from "@/components/ui/PosterCard";
import { Card3D } from "@/components/ui/Card3D";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ProgressControl } from "@/components/ui/ProgressControl";
import { AiPanel } from "@/components/screens/AiPanel";

export function AnimeDetail({ id }: { id: number }) {
  const { data: anime } = useQuery({ queryKey: ["anime", id], queryFn: () => getAnimeDetails(id) });
  const { data: chars } = useQuery({ queryKey: ["chars", id], queryFn: () => getCharacters(id) });
  const { data: recs } = useQuery({ queryKey: ["recs", id], queryFn: () => getRecommendations(id) });
  if (!anime) return <p className="p-8 text-white/40">Loading…</p>;

  return (
    <div className="relative pt-8">
      <HeroBackdrop tint="#7C3AED" />
      <div className="px-4">
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={anime.cover} alt={anime.title} className="h-56 w-40 rounded-2xl object-cover shadow-xl" />
          <div className="flex flex-col justify-end">
            <h1 className="text-2xl font-black">{anime.title}</h1>
            <p className="text-sm text-accent-gold">★ {anime.score ?? "–"} · {anime.type ?? ""} · {anime.episodes ?? "?"} eps</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {anime.genres.slice(0, 4).map((g) => <span key={g} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{g}</span>)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FavoriteButton anime={anime} />
          <ProgressControl anime={anime} maxEpisodes={anime.episodes} />
        </div>

        {anime.description && (
          <p className="mt-4 text-sm leading-relaxed text-white/70"
            dangerouslySetInnerHTML={{ __html: anime.description }} />
        )}

        <AiPanel anime={anime} />
      </div>

      {!!chars?.length && (
        <Carousel title="Characters">
          {chars.map((c) => (
            <Card3D key={c.id} className="w-24 shrink-0 overflow-hidden rounded-2xl bg-ink-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image ?? ""} alt={c.name} className="aspect-[2/3] w-full object-cover" />
              <p className="line-clamp-2 p-1 text-[10px]">{c.name}</p>
            </Card3D>
          ))}
        </Carousel>
      )}

      {!!recs?.length && (
        <Carousel title="You Might Like">{recs.map((a) => <PosterCard key={a.id} anime={a} />)}</Carousel>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `app/anime/[id]/page.tsx`**

```tsx
import { AnimeDetail } from "@/components/screens/AnimeDetail";

export default async function AnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main><AnimeDetail id={Number(id)} /></main>;
}
```

- [ ] **Step 5: Verify** (AiPanel comes from Task 15 — build after Task 15, or temporarily stub `AiPanel` returning `null`)

Run: `npm run build` after Task 15. Manual: open `/anime/<id>` (e.g. a trending id), confirm hero, poster, genres, favorite toggle, and progress control all work.

- [ ] **Step 6: Commit**

```bash
git add app/anime components/screens/AnimeDetail.tsx components/ui/FavoriteButton.tsx components/ui/ProgressControl.tsx && git commit -m "feat: add anime detail page with actions, characters, recs"
```

---

### Task 15: AI panel (summary, catch-up, spoiler-safe chat)

**Files:**
- Create: `lib/ai/useAi.ts`
- Create: `components/screens/AiPanel.tsx`

**Interfaces:**
- Consumes: `/api/ai` (Task 8), `getSpoilerCeiling` (Task 6), `Anime` (Task 2).
- Produces: `useAi()` hook posting to `/api/ai`; `<AiPanel anime />` with buttons for Summary / Catch me up and a chat box, all sending the current spoiler ceiling.

- [ ] **Step 1: Implement `lib/ai/useAi.ts`**

```ts
"use client";
import { useState } from "react";
import type { AiTask } from "@/lib/ai/prompts";

interface AiArgs { task: AiTask; animeTitle: string; ceiling: number; question?: string; characterName?: string; context?: string; }

export function useAi() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function ask(args: AiArgs) {
    setLoading(true); setError(false); setText("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { text: string };
      setText(json.text);
    } catch { setError(true); } finally { setLoading(false); }
  }
  return { text, loading, error, ask };
}
```

- [ ] **Step 2: Implement `components/screens/AiPanel.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useAi } from "@/lib/ai/useAi";
import { getSpoilerCeiling } from "@/lib/storage/store";
import type { Anime } from "@/lib/anime/types";

export function AiPanel({ anime }: { anime: Anime }) {
  const { text, loading, error, ask } = useAi();
  const [ceiling, setCeiling] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => setCeiling(getSpoilerCeiling(anime.id)), [anime.id]);

  const base = { animeTitle: anime.title, ceiling, context: anime.description ?? undefined };
  return (
    <section className="mt-6 rounded-3xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-transparent p-4">
      <h2 className="mb-3 text-lg font-bold">✨ AI Companion <span className="text-xs font-normal text-white/40">(spoiler-safe to ep {ceiling})</span></h2>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => ask({ ...base, task: "summary" })} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">AI Summary</button>
        <button onClick={() => ask({ ...base, task: "catchup" })} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">Catch me up</button>
        <button onClick={() => ask({ ...base, task: "recommend" })} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">Recommend</button>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask({ ...base, task: "chat", question: q }); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything (spoiler-safe)…"
          className="flex-1 rounded-full border border-white/10 bg-ink-800 px-4 py-2 text-sm outline-none focus:border-accent-purple" />
        <button className="rounded-full bg-accent-purple px-4 py-2 text-sm font-semibold">Ask</button>
      </form>
      {loading && <p className="mt-3 animate-pulse text-sm text-white/40">Thinking…</p>}
      {error && <p className="mt-3 text-sm text-accent-crimson">AI is unavailable. Check GEMINI_API_KEY.</p>}
      {text && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{text}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build` → Expected: succeeds. Manual (needs `GEMINI_API_KEY` in `.env.local`): set progress to ep 5, click "AI Summary", confirm a spoiler-safe answer; ask "who is the final villain?" and confirm it declines/deflects.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/useAi.ts components/screens/AiPanel.tsx && git commit -m "feat: add AI companion panel with spoiler-safe requests"
```

---

### Task 16: Library page (favorites, continue watching, stats)

**Files:**
- Create: `app/library/page.tsx`
- Create: `components/screens/LibraryView.tsx`

**Interfaces:**
- Consumes: `getFavorites`, `getContinueWatching` (Task 6), `PosterCard` (Task 10).
- Produces: `/library` route showing continue-watching, favorites grid, and basic stats.

- [ ] **Step 1: Implement `components/screens/LibraryView.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { getFavorites, getContinueWatching } from "@/lib/storage/store";
import { PosterCard } from "@/components/ui/PosterCard";
import { Carousel } from "@/components/ui/Carousel";
import type { AnimeSummary } from "@/lib/anime/types";

export function LibraryView() {
  const [favs, setFavs] = useState<AnimeSummary[]>([]);
  const [cw, setCw] = useState<{ anime: AnimeSummary; episode: number }[]>([]);
  useEffect(() => { setFavs(getFavorites()); setCw(getContinueWatching()); }, []);

  return (
    <div className="pt-8">
      <h1 className="mb-6 px-4 text-2xl font-black">Library</h1>
      <div className="mb-6 grid grid-cols-2 gap-3 px-4">
        <div className="rounded-2xl bg-ink-800 p-4"><p className="text-2xl font-black text-accent-purple">{favs.length}</p><p className="text-xs text-white/50">Favorites</p></div>
        <div className="rounded-2xl bg-ink-800 p-4"><p className="text-2xl font-black text-accent-blue">{cw.length}</p><p className="text-xs text-white/50">In progress</p></div>
      </div>
      {cw.length > 0 && <Carousel title="Continue Watching">{cw.map((p) => <PosterCard key={p.anime.id} anime={p.anime} />)}</Carousel>}
      <h2 className="mb-3 mt-4 px-4 text-lg font-bold">Favorites</h2>
      {favs.length === 0 ? <p className="px-4 text-sm text-white/40">No favorites yet — tap ❤️ on any anime.</p> : (
        <div className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 md:grid-cols-6">{favs.map((a) => <PosterCard key={a.id} anime={a} />)}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `app/library/page.tsx`**

```tsx
import { LibraryView } from "@/components/screens/LibraryView";
export default function LibraryPage() { return <main><LibraryView /></main>; }
```

- [ ] **Step 3: Verify**

Run: `npm run build` → Expected: succeeds. Manual: favorite an anime, set progress, confirm both appear in Library.

- [ ] **Step 4: Commit**

```bash
git add app/library components/screens/LibraryView.tsx && git commit -m "feat: add library page with favorites, continue watching, stats"
```

---

### Task 17: Page transitions + polish pass

**Files:**
- Create: `components/ui/PageTransition.tsx`
- Modify: `app/layout.tsx`
- Create: `app/loading.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` (Task 10).
- Produces: a subtle fade/slide wrapper applied to route content; a global loading skeleton.

- [ ] **Step 1: Implement `components/ui/PageTransition.tsx`**

```tsx
"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div key={path}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Wrap children in `app/layout.tsx`**

Change `<Providers>{children}</Providers>` to:

```tsx
<Providers><PageTransition>{children}</PageTransition></Providers>
```

Add import: `import { PageTransition } from "@/components/ui/PageTransition";`

- [ ] **Step 3: Add `app/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <div className="space-y-6 p-4 pt-12">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          {[0, 1, 2, 3].map((j) => <div key={j} className="h-48 w-32 animate-pulse rounded-2xl bg-ink-700" />)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run build` → Expected: succeeds. Manual: navigate between tabs, confirm smooth fade; enable reduced-motion and confirm transitions are disabled.

- [ ] **Step 5: Commit**

```bash
git add components/ui/PageTransition.tsx app/layout.tsx app/loading.tsx && git commit -m "feat: add page transitions and loading skeleton"
```

---

### Task 18: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run` → Expected: all tests PASS.

- [ ] **Step 2: Production build**

Run: `npm run build` → Expected: succeeds with no type errors.

- [ ] **Step 3: Lint**

Run: `npm run lint` → Expected: no errors.

- [ ] **Step 4: Manual smoke on mobile viewport**

`npm run dev`, DevTools device toolbar (iPhone): Home carousels load, search type-ahead works, anime page opens with hero + AI panel, favorite + progress persist across reload, Library reflects them.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "chore: final verification fixes" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** Home/Search/AnimePage/EpisodePage(→ AI panel lives on anime page; standalone episode page is deferred with video)/Library ✓; AniList+Jikan ✓; 5 AI features (summary, catchup, chat, character via prompt builder, recommend) ✓; spoiler ceiling ✓; browser storage ✓; 3D cards + WebGL hero + guardrails ✓; color tokens ✓. **Note:** the standalone Episode *page* from the spec is intentionally folded into the AnimeDetail AI panel for v1 since there is no video; a dedicated episode route is deferred to the streaming phase. Character-explainer UI is reachable via chat ("explain <character>"); a dedicated tap-a-character flow can be added later.
- **Placeholder scan:** none — all steps contain real code/commands.
- **Type consistency:** `AnimeSummary`/`Anime`/`Character`/`Episode` used consistently; storage signatures match usage in Tasks 11/14/16; `AiTask` enum matches route + prompt builder + `useAi`.
