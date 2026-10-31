# Anime Attack

A premium, glass-UI anime streaming and manga reading app built with Next.js 15, React 19 and Tailwind 4.
Sub/dub streaming with a fully custom player, season navigation, a vertical manga reader, and five themes.

## Highlights

- **Custom HLS player** — quality switching (auto + per-bitrate), subtitle tracks, playback speed, PiP,
  fullscreen, ±10s skip, buffered bar, keyboard shortcuts, resume and progress saving.
- **Reliable streaming pipeline** — resolves episodes through the aniwatch player into the megavid source
  API, fails over across four providers, and proxies playlists so CORS and content-type quirks cannot
  break playback.
- **Season navigation** — AniList `Media.relations` powers a Season 1 → N switcher on every detail page.
- **Manga reader** — MangaDex search, hosted-chapter reader with HD/Lite modes, proxied images, and
  honest handling of licensed titles that only have official external links.
- **Five themes** — `midnight`, `obsidian`, `neon`, `sakura`, `paper`, with no flash of unstyled theme.
- **Discovery** — trending, top airing, movies, browse with filters, airing schedule, characters, library.

## Stack

Next.js 15.5 · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query · framer-motion · hls.js ·
three.js · zod · vitest

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
```

Production check:

```bash
npm run build
npm run start -- -p 3100
```

Optional environment (`.env.local`):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Enables the AI recap / Q&A panel. Without it the panel degrades gracefully. |

## Project layout

```
app/                     routes (App Router) + API route handlers
  api/anime/source/      episode source resolution (provider failover)
  api/proxy/media/       HLS playlist rewriting, segments, SRT→VTT
  api/manga/             search, detail, chapter feed, image proxy
components/player/       custom video player
components/screens/      page-level views (home, detail, watch, browse, …)
components/manga/        manga browser, detail, reader
lib/anime/               AniList, Jikan, Kitsu, aniwatch + megavid pipeline
lib/manga/               MangaDex data layer
docs/STREAMING-APIS.md   full API research, contracts and APK reuse notes
```

## Documentation

- [`docs/STREAMING-APIS.md`](docs/STREAMING-APIS.md) — every upstream API, tested endpoint contracts,
  provider behaviour, failure modes and how to reuse the pipeline from a mobile client.

## Notes

This project resolves third-party streams and does not host any media. Licensed manga is surfaced only
as links to official publishers. Episode availability, quality and subtitle tracks depend entirely on
upstream providers. See the caveats section of the API document.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx vitest run` | Unit tests |
