# Anime Companion — v1 Design Spec

**Date:** 2026-07-05
**Status:** Approved for planning

## Vision

The fastest, smartest anime companion on the web — a mobile-first responsive site
that feels like a premium native app. Discovery (Netflix-style browsing) + an AI
companion (spoiler-aware summaries, catch-up, character explainers, chat) that is
the product's real differentiator. **No video streaming in v1.**

## Non-negotiable feel

- Ridiculously fast, gorgeous near-black UI, 60fps animation, AI everywhere, zero clutter, premium.
- Aesthetic: base `#080808` / `#121212` / `#1C1C1C`; accents purple / blue / crimson / gold;
  heavy blur, gradients, rounded cards, shared-element transitions, physics scrolling.
- **Extra premium visual layer:** 3D tilt poster cards, a WebGL/Three.js hero backdrop,
  parallax — all with hard performance and accessibility guardrails (below).

## Scope decisions (locked)

- **Platform:** Responsive website (Next.js + React web). Not React Native.
- **V1 focus:** Discovery + AI companion. No video.
- **AI provider:** Gemini API, via a server-side proxy (key never in browser).
- **Persistence:** Browser only (localStorage/IndexedDB). No auth, no DB in v1.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind CSS.** Mobile-first, one codebase.
- **Framer Motion** — shared-element transitions, card expand, page transitions.
- **TanStack Query** — data fetching, caching, dedupe, background refetch.
- **Embla Carousel** — Netflix-style horizontal rows.
- **react-three-fiber + drei** — WebGL hero backdrop only (one instance per page, lazy-loaded).
- **next/image** — responsive, optimized posters.
- **Server API routes** (`/app/api/*`) — thin proxy layer for AniList caching and Gemini calls.

### Module boundaries

- `lib/anime/` — typed data access (`getTrending`, `searchAnime`, `getAnimeDetails`,
  `getCharacters`, `getEpisodes`, `getRecommendations`, `getAiringSchedule`). Screens never
  touch raw GraphQL. AniList primary, Jikan fallback + filler/canon data.
- `lib/ai/` — client hooks calling `/api/ai/*`; prompt construction lives server-side.
- `lib/storage/` — typed wrapper over localStorage for progress/favorites/history/spoiler-ceiling.
- `components/ui/` — primitives (Card3D, Carousel, HeroBackdrop, BottomSheet, SkeletonRow, Chip).
- `components/screens/` — Home, Search, AnimePage, EpisodePage, Library.

## Data layer (legal, free)

- **AniList GraphQL** = primary: trending, top airing, popular movies, search + filters,
  anime details, characters, studios, genres, relations, recommendations, airing schedule.
- **Jikan (MyAnimeList)** = fallback metadata + filler/canon episode classification.
- **No streaming.** Episode lists/metadata only. AnimeSuge captures (`some-apis.txt`) retained
  for a possible later "sources" phase — out of scope now.
- Server-side response caching (TanStack Query client-side + route-level cache headers) to keep
  it fast and stay within AniList rate limits.

## AI companion (Gemini) — v1 subset

Server routes under `/api/ai/`, each constrained by a **spoiler ceiling** = the user's current
episode N for that anime (from `lib/storage`). Answers must not reveal content beyond N; when a
question requires later content, respond that it's beyond the user's progress and offer a
spoiler-free alternative.

1. **AI Summary** — 1-line + full summary of an anime.
2. **Catch me up / Story so far** — recap up to episode N.
3. **Spoiler-safe chat** — Q&A ("Who is Yami?") bounded by N.
4. **Character explainer** — who/power/relationships bounded by N.
5. **Smart recommendations** — reasoned ("you liked X because… try Y").

Prompts are built server-side from AniList/Jikan context + the spoiler ceiling. Gemini key read
from `GEMINI_API_KEY` env, server-only.

**Deferred (not v1):** episode timeline scrubbing, relationship graph, power-evolution timeline,
watch-parties, voice assistant, downloads, notifications, cloud accounts, community/reviews.

## Persistence (browser)

`lib/storage` over localStorage (JSON-serialized, versioned key namespace):
- **continue-watching** (anime id, episode, timestamp)
- **favorites**
- **watch-history**
- **spoiler ceiling** — per-anime "I'm on episode N" (drives all AI features)

Per-device, no auth. Cloud sync is a later phase.

## Screens

- **Home** — greeting + carousels: Continue Watching, Trending Today, Top Airing,
  Popular Movies, Recently Updated, Recommended For You, Upcoming Episodes. WebGL hero at top.
- **Search** — instant type-ahead results as you type; filter bottom-sheet
  (genre / year / type: TV/Movie/OVA/ONA / status / rating / episodes).
- **Anime page** — hero backdrop + gradient overlay, title/rating/type/genres,
  actions (Favorite / List / set progress), synopsis (read-more), **AI Summary** button,
  characters carousel (3D tilt cards), episode list with range selector + find + filler/canon tags.
- **Episode page** — episode metadata, **AI recap**, **spoiler-safe chat** panel, prev/next.
  A styled "player coming soon" placeholder card where video would later live.
- **Library / Profile** — favorites grid, watch history timeline, basic stats
  (episodes/genres), spoiler-progress control.

## Premium visual layer — with guardrails

- **Card3D** — pointer/gyro-driven tilt + parallax glare on poster cards. Implemented with CSS
  3D transforms + Framer Motion (GPU-cheap), NOT a Three.js instance per card.
- **HeroBackdrop** — a single lazy-loaded react-three-fiber canvas (animated gradient/particle
  shader tinted from the active poster). One per page max.
- **Guardrails:** respect `prefers-reduced-motion` (disable tilt + heavy motion); disable/gyro-
  downgrade the WebGL hero on low-end/mobile via a capability check; never block first paint on
  WebGL; keep interactions at 60fps (transform/opacity only, no layout thrash).

## Testing

- Unit: `lib/anime` mappers (AniList/Jikan → typed models), `lib/storage`, spoiler-ceiling logic.
- Component: carousels, Card3D (reduced-motion path), search type-ahead debounce.
- AI routes: prompt construction includes the spoiler ceiling; mocked Gemini responses;
  assert beyond-N questions get the guarded response.

## Explicitly out of v1

Video streaming/downloads, auth/cloud sync, watch-parties, notifications, community/reviews,
voice assistant, relationship graph, power-evolution timeline, native (React Native) app.
