# Anime Attack — Streaming, Metadata and Manga API Reference

Reference for **Anime Attack** (`anime-companion`): Next.js 15 App Router, served on `http://localhost:3100`.
Repo `/Users/tushargautam/Documents/Anime App`, revision `101941d`. Live probes: **2026-10-31 (UTC)**.
Stack: `next 15.5.20`, `react 19.1.0`, `hls.js ^1.7.4`, `zod ^4.4.3`, `@tanstack/react-query ^5.101.2`.

**Part I** documents the app's own contract (`app/api/**`, `lib/client/api.ts`); **Part II** documents every
upstream, including the ones that were rejected.

| Tag | Meaning |
| --- | --- |
| `[code]` | Traceable to a named file in the repo; behaviour follows from the source text. |
| `[live]` | Observed with `curl` on 2026-10-31 against the dev server and the real upstreams. |
| `[unverified]` | Neither — stated in the brief, inferred, or not reproducible. |

Where `[code]` and `[live]` disagree, both are printed. The working tree moved during writing (the
`PROVIDER_ORDER` trim, category-based feed search, the aniwatch mirror fallback), so `[code]` follows the tree as
handed over while `[live]` is a timestamped snapshot — and the dev server was no longer listening on port 3100 when
this document was finalised.

**Contents** — *Internal (Part I):* [1 conventions](#1-conventions) · [2 discover](#2-get-apianimediscover) ·
[3 detail](#3-get-apianimeid) · [4 episodes](#4-get-apianimeepisodes) · [5 latest](#5-get-apianimelatest) ·
[6 source](#6-get-apianimesource) · [7 characters](#7-get-apicharacters--apicharactersid) · [8 schedule](#8-get-apischedule) ·
[9 manga](#9-manga-endpoints) · [10 media proxy](#10-gethead-apiproxymedia) · [11 aniwatch/quotes](#11-apiproxyaniwatch-and-apiproxyquotes) ·
[12 ai](#12-post-apiai) · [13 client wrapper](#13-libclientapits) · [14 master table](#14-master-table)
*Upstreams (Part II):* [15 AniList](#15-anilist-graphql) · [16 Jikan](#16-jikan) · [17 Kitsu](#17-kitsu) · [18 quotes](#18-quotes-animechan) ·
[19 aniwatch](#19-aniwatch-wordpress-api) · [20 pipeline](#20-streaming-pipeline-aniwatch--player--megavid) · [21 gate](#21-the-referercors-gate) ·
[22 subtitles](#22-subtitle-tracks) · [23 megaplay/anikoto](#23-alternative-source-family-megaplay--anikoto) · [24 MangaDex](#24-mangadex) ·
[25 dead](#25-dead-and-rejected-endpoints) · [26 fixtures](#26-verified-title-fixtures) · [27 playbook](#27-failure-playbook) ·
[28 mobile](#28-mobile--apk-reuse-notes) · [29 legal](#29-legal-caveats) · [A checks](#appendix-a--re-running-the-checks) ·
[B unverified](#appendix-b--explicitly-unverified)

---

# Part I — Internal API

## 1. Conventions

The browser never touches a gated CDN directly: `lib/client/api.ts` and hls.js call route handlers, which add
headers a page cannot forge. JSON routes wrap AniList, Jikan, aniwatch WordPress, megavid, MangaDex and Gemini;
`/api/proxy/media` carries megavid playlists and MPEG-TS segments.

**Error shape.** `{ "error": "<message>" }`, plus `items: []` on list endpoints so a client can render an empty
state without branching on status `[code]`. `/api/anime/source` is the exception: it mirrors the megavid
contract and uses `{ status, message }`. Codes: `200` ok, `400` bad/missing parameter, `403` AI cross-origin
only, `404` unresolvable slug, `502` upstream failure.

**Cache model** `[code]`: `public, s-maxage=N, stale-while-revalidate=M` for metadata, `no-store, max-age=0` for
stream resolution and chapter pages, plus `next: { revalidate: N }` on cacheable internal fetches.

**Durations** `[code]` — every route is `runtime = "nodejs"`; `maxDuration` is 30 except `anime/source` (60,
`force-dynamic`), `manga/chapter/[id]` (45) and `proxy/media` (60, `force-dynamic`), and the three remaining routes
leave it at the default. Cache TTLs per route are in §14. `vercel.json` pins region `bom1` and caps `proxy/media`
at **30 s** although the route declares 60, so a long segment fetch can be cut short in production only.

## 2. `GET /api/anime/discover`

One endpoint for home, search and browse. Wraps AniList only.

| Param | Default | Notes |
| --- | --- | --- |
| `kind` | `trending` | `trending \| airing \| movies \| search \| browse`; any other value behaves as `trending` `[code]` |
| `q` | — | `search` only; trimmed, `< 2` chars returns `{items: []}` at 200 `[code]` |
| `page` | 1 | `search` only, clamped `>= 1` |
| `genre` `year` `format` `status` `sort` | — / `POPULARITY_DESC` | `browse` only; `sort` is any `MediaSort` |
| `season` | — | **not accepted by the route** although `browseAnime()` supports it `[code]` |

```json
{
  "items": [{
    "id": 195604, "title": "Black Clover Season 2",
    "cover": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx195604-tSZcfKbVqSEG.jpg",
    "banner": "https://s4.anilist.co/file/anilistcdn/media/anime/banner/195604-lQpCzTziSA17.jpg",
    "type": "TV", "score": 8.7, "year": 2026
  }],
  "kind": "trending"
}
```

`search` adds `q` and `page` to the envelope. `score` is `Math.round(averageScore)/10` (`87 → 8.7`), `null` when
unscored; `type` is `null` outside the six-value enum; `banner` may be `null` `[code]`. Page sizes: AniList
`perPage` 20 for trending/airing/movies/search and 30 for browse, which ignores `page` and always returns AniList
page 1 `[code]`.

Cache `public, s-maxage=300, stale-while-revalidate=900` `[code]` `[live]`; failure `502 {error, items: []}`.
Live 200s: `trending`, `airing`, `movies`, `search&q=bleach`, `browse&genre=Action&year=2024` `[live]`.

## 3. `GET /api/anime/[id]`

AniList id (not MAL). Five queries in parallel; only `getAnimeDetails` is mandatory — the rest are wrapped in
a `settle()` helper `[code]`.

| Section | Query | Degraded value |
| --- | --- | --- |
| `anime` | `DETAILS` | failure → `502` |
| `malId`, `accentColor` | `ANIME_EXTRAS` | `{ idMal: null, color: null }` |
| `relations` | `RELATIONS` | `[]` |
| `characters` | `CHARACTERS` | `[]` |
| `recommendations` | `RECOMMENDATIONS` | `[]` |

```json
{ "anime": { "id": 21, "title": "ONE PIECE", "type": "TV", "score": 8.7, "year": 1999,
    "cover": "https://…/bx21-ELSYx3yMPcKM.jpg", "banner": "https://…/banner/21-wf37VakJmZqs.jpg",
    "bannerImage": "https://…/banner/21-wf37VakJmZqs.jpg", "status": "RELEASING", "episodes": null,
    "description": "Gold Roger was known as the Pirate King, the strongest and most infamous being…",
    "genres": ["Action", "Adventure", "Comedy", "Drama", "Fantasy"], "studios": ["Toei Animation"],
    "seasonYear": 1999, "nextAiringEpisode": { "episode": 1181, "airingAt": 1793600000 } },
  "malId": 21, "accentColor": "#e49335",
  "relations": [{ "id": 466, "title": "One Piece: Defeat the Pirate Ganzack!", "type": "OVA", "score": 6.5,
                  "year": 1998, "relationType": "SIDE_STORY", "episodes": 1, "status": "FINISHED" }],
  "characters": [{ "id": 40, "name": "Luffy Monkey", "role": "MAIN", "voiceActor": "Mayumi Tanaka",
                   "image": "https://…/b40-MNypXsxSRb1R.png" }],
  "recommendations": [{ "id": 11061, "title": "Hunter x Hunter (2011)", "type": "TV", "score": 8.9, "year": 2011 }] }
```

Verbatim from `/api/anime/21` `[live]` (40 relations, 25 characters, 20 recommendations — matching the AniList
page sizes in §15). `relations` keep only `type === "ANIME"` with `relationType` in
`PREQUEL, SEQUEL, PARENT, SIDE_STORY, ALTERNATIVE, SPIN_OFF` and `format !== "MUSIC"`, sorted oldest-first by
`year` then `id`, so the switcher reads Season 1 → N `[code]`.

Cache `s-maxage=600`, swr 1800. Errors: `400 {"error":"Invalid anime id"}` for non-numeric or `<= 0`;
`502 {"error":"<message>"}` `[code]` `[live]`.

## 4. `GET /api/anime/episodes`

`mal` is required; non-numeric or `<= 0` → `400 {"error":"Valid ?mal= is required"}` `[code]` `[live]`.

Upstreams `[code]`: AniList `Media(idMal:, type:)` → `id idMal format status episodes seasonYear
nextAiringEpisode { episode } title { english romaji native }` (`AbortSignal.timeout(8000)`, `revalidate: 3600`);
Jikan `/v4/anime/{malId}/episodes` (`AbortSignal.timeout(4000)`, `revalidate: 3600`).

```
announced  = Media.episodes ?? null
total      = announced ?? (nextAiringEpisode.episode != null ? max(nextAiringEpisode.episode - 1, 1) : null)
isMovie    = format === "MOVIE" || total === 1
```

Fallback ladder `[code]`:

| # | Condition | Result | `source` |
| --- | --- | --- | --- |
| 1 | Jikan returned rows | real titles, `filler` preserved | `"jikan"` |
| 2 | Jikan empty, no total, `status === "RELEASING"` | 500 placeholder episodes | `"generated"` |
| 3 | Jikan empty, `total > 0` | `min(total, 2000)` placeholders; single-episode titles named `"Movie"` | `"generated"` |
| 4 | otherwise | `[]`, still `"jikan"` | `"jikan"` |

```json
{ "malId": 21, "anilistId": 21, "title": "ONE PIECE", "format": "TV",
  "totalEpisodes": 1180, "year": 1999, "isMovie": false,
  "episodes": [{ "number": 1, "title": null, "filler": false }], "source": "generated" }
```

Live samples (Jikan was down, so all used the generated path) `[live]`: `?mal=21` → 1180/1180, `?mal=61323`
(Blue Box S2) → 12/12, `?mal=32281` (Your Name) → 1 episode titled `"Movie"` with `isMovie: true`, `?mal=1535`
(Death Note) → 37/37.

A failed Jikan is negatively cached per MAL id for 5 minutes (`jikanCooldown`), so a stall costs one 4 s timeout
per anime rather than one per request `[code]`. The declared union includes `"anilist"` but no path assigns it
`[code]`. Cache `s-maxage=900`, swr 3600.

## 5. `GET /api/anime/latest`

aniwatch WordPress feed plus search over the same feed.

| Param | Default | Notes |
| --- | --- | --- |
| `q` | — | Present → series search over the same feed, bypassing `page` (see below) |
| `page` | 1 | clamped `>= 1`; listing mode only |
| `per_page` | 12 | clamped 1–30 `[code]` (the helper allows 100); also the cap on search results |

```json
{ "items": [{ "id": 35890, "date": "2026-10-31T02:16:00",
  "slug": "magic-repo-man-…-episode-5-english-subbed",
  "title": "Magic Repo Man: … Episode 5 English Subbed",
  "link": "https://aniwatchtv.by/magic-repo-man-…-episode-5-english-subbed/",
  "categoryIds": [2493], "tags": [] }],
  "q": null, "page": 1 }
```

`title`/`link` keep HTML entities (`&#8217;`), so clients must decode `[code]` `[live]`. Cache `s-maxage=120`,
swr 600 — the shortest TTL in the app. Failure `502 {error, items: []}`.

Search mode is not a plain `posts?search=` call: that endpoint returns **0 rows** on this WordPress install
`[live]`, so `searchPosts()` resolves the query to series categories (`categories?search=` with the term
hyphenated), ranks them by exact-slug match then post count, pulls episodes from the best one or two categories
and slices to `per_page` `[code]`. Series that are not category-matched therefore return `{items: []}` rather
than a fuzzy hit.

## 6. `GET /api/anime/source`

Stream resolution. Returns the megavid contract verbatim (no envelope) and is the only `no-store` metadata route.

| Param | Notes |
| --- | --- |
| `mal`, `ep` | Preferred input; `ep > 0` |
| `audio` | `sub` (default) or `dub`; anything else is treated as `sub` `[code]` |
| `slug` | Used only when `mal`/`ep` are missing |
| `provider` | Pins a provider first; the rest of `PROVIDER_ORDER` still follows as fallback |
| `refresh` | `1` bypasses the 90 s in-process source cache |

Resolution when `mal`/`ep` are absent `[code]`:

1. `resolveTargetFromSlug(slug)` — fetch `https://aniwatchtv.by/{slug}/`, take the first `<iframe src>`, regex
   `megavid\.buzz/mal/(\d+)/(\d+)/(sub|dub)`; if the iframe is a player indirection, fetch that page and repeat.
   Cached 10 min.
2. On failure `resolveSlugToMal(slug)` — title derived from the slug itself (the code treats WP `posts?slug=` as
   unreliable), then AniList search → `idMal` via `ANIME_EXTRAS`, with a season-aware best-match so "Season 3"
   does not resolve to the season-1 entry; episode parsed from `-episode-N` / `-ep-N`. Cached 30 min, negatives
   included.
3. Neither → `404`.

Two fallbacks sit after resolution: `fetchMegaSource()` walks the provider list, and if megavid answers `missing`
or `error` while a `slug` is known, the route calls `extractVideoUrl(slug)` (no longer dead code) and returns the aniwatch
blogger/JW-Player mirror instead — `status: "ok"`, `type: "mp4"`, `provider: "aniwatch"`, `tracks: []` and the
message `"Playing from the aniwatch mirror (single quality)."` `[code]` (the mirror itself was not reproduced
`[live]`; see Appendix B).

```json
{ "status": "ok",
  "source": "https://cp.megavid.buzz/hls/1e810e75-bc54-4101-8038-e891e23ce7ff/playlist.m3u8",
  "type": "hls",
  "tracks": [{ "file": "https://megavid.buzz/sub/s5xTL2uGu…/3d69e3d8….vtt",
               "label": "English", "kind": "captions", "default": true }],
  "providers": [], "provider": "loli", "malId": 1535, "episode": 1, "audio": "sub" }
```

| `status` | HTTP | Meaning | Client |
| --- | --- | --- | --- |
| `ok` | 200 | `source` is a live playlist | play via `/api/proxy/media` |
| `missing` | 200 | upstream says the episode is absent | "not found"; dub-missing → offer sub |
| `countdown` | 200 | `countdownUrl` (`iframeUrl`) for an unaired episode | show countdown |
| `error` | 400/404/502 | nothing playable, `message` explains | show error, retry |

`missing`/`countdown`/`error` are **HTTP 200 bodies**; only parameter and resolution failures use 4xx/5xx `[code]`.

| Live request | Result `[live]` |
| --- | --- |
| `?mal=1535&ep=1&audio=sub` | `ok`, `loli`, `type:"hls"`, `cp.megavid.buzz`, 2 tracks |
| `?mal=1535&ep=1&audio=dub` | `ok`, `cp.megavid.buzz/hls/f82b8e26-…`, 1 track |
| `?mal=21&ep=1180&audio=sub` | `ok`, `megavid.buzz/vid/…`, `type` absent upstream → synthesised `"hls"` |
| `?mal=1535&ep=1&audio=sub&provider=zuna` | `ok`, fell back to `loli` (zuna's host is NXDOMAIN) |
| `?mal=1535&ep=9999&audio=sub` | `missing` + message "We couldn't find this episode…" |
| *no params* / `?mal=1535` without `ep` | `404 {"status":"error","message":"Could not work out which anime this episode belongs to. Open it from the anime page."}` |

Caching `[code]`: `sourceCache` keyed `mal:ep:audio:provider` holds 90 s on success, 30 s for `countdown` and 15 s
for failures; `targetCache` holds slugs 10 min. `refresh=1` touches only `sourceCache`.

## 7. `GET /api/characters` / `/api/characters/[id]`

`/api/characters?page=&q=` → AniList `Page(page:, perPage: 30) { characters(sort: FAVOURITES_DESC, search:) }`:

```json
{ "items": [{ "id": 17, "name": "Naruto Uzumaki",
              "image": "https://s4.anilist.co/file/anilistcdn/character/large/b17-….png",
              "favourites": 51234 }], "page": 1 }
```

Cache `s-maxage=600`, swr 1800; failure `502 {error, items: []}` `[code]`.

`/api/characters/[id]` → `Character(id:)` with `description(asHtml:false)`, `gender`, `age`, `favourites` and up
to 12 media nodes sorted `POPULARITY_DESC`:

```json
{ "character": {
  "id": 40, "name": "Luffy Monkey", "native": "モンキー・D・ルフィ", "favourites": 35981,
  "image": "https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png",
  "description": "__Height:__ 172 cm\n__Affiliations:__ ~!Straw Hat Pirates (Captain)…!~",
  "gender": "Male", "age": "17-",
  "media": [{ "id": 21, "title": "ONE PIECE", "type": "TV", "score": 8.7, "year": 1999 }] } }
```

The description keeps AniList markup — `__bold__`, `~!spoiler!~`, inline Markdown links `[live]`; sanitise it.
Cache `s-maxage=3600`, swr 86400; `400 {"error":"Invalid character id"}`; `502` on upstream failure.

## 8. `GET /api/schedule`

No parameters. `Page(page: 1, perPage: 40) { airingSchedules(notYetAired: true, sort: TIME) }` — future airings
only, earliest first; the route never passes a page, so pagination is not exposed over HTTP `[code]`.

```json
{ "items": [{ "id": 410607, "title": "Little Shark's Day Out Season 2",
              "cover": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx204269-fTR4iyVjTHiC.png",
              "episode": 30, "airingAt": 1793484000 }] }
```

`airingAt` is Unix **seconds**; `cover` is `""` (never null) when AniList has none; a null `episode` would fail
the Zod schema and surface as `502` `[code]`. Cache `s-maxage=600`, swr 1800 (40 items returned) `[live]`.

## 9. Manga endpoints

All wrap MangaDex. Ids are UUIDs validated against `/^[a-f0-9-]{36}$/i` before any upstream call `[code]`.

**`GET /api/manga/search`** — `q` (→ `title=`, forcing `order[relevance]=desc`), `page` (**0-based**,
`offset = page * 24`), `order` (`latest` → `order[latestUploadedChapter]=desc`, else `order[followedCount]=desc`),
`readable=1` → `hasAvailableChapters=true` `[code]`. Fixed: `limit=24`, `contentRating[]=safe`,
`contentRating[]=suggestive`, `includes[]=cover_art`, **`availableTranslatedLanguage[]=en`**.

```json
{ "items": [{ "id": "c46455c3-86ec-420d-90f6-4c60a3c6cc93", "title": "Saitama Chainsaw Shoujo",
  "description": "Kirisaki Fumio's just a highschool girl in love…", "status": "completed", "year": 2008,
  "cover": "/api/manga/image?url=https%3A%2F%2Fuploads.mangadex.org%2Fcovers%2F…%2F….jpg.512.jpg",
  "contentRating": "safe", "latestChapter": "4",
  "tags": ["Action", "Psychological", "Comedy", "Drama", "School Life"] }],
  "page": 0, "limit": 24, "total": 11 }
```

`cover` is **already proxied** through `/api/manga/image`; `tags` cap at 8 English names `[code]`. Cache
`s-maxage=300`, swr 900; `502` on failure. Live: `?q=chainsaw&readable=1` → 11 items, while `?order=readable`
returns 24 items and a different `total` (49348 vs 49347) — `order=readable` is silently treated as `popular`, so
the bundled verify script passes without testing the readable filter `[live]`.

**`GET /api/manga/[id]`** — `/manga/{id}?includes[]=cover_art&includes[]=author&includes[]=artist`, then
`/manga/{id}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0` `[code]`. Note the
asymmetry: the **list** takes `availableTranslatedLanguage[]`, the **feed** takes `translatedLanguage[]` (§24.1).

```json
{ "id": "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0", "title": "Na Honjaman Level-Up", "status": "completed",
  "year": 2018, "latestChapter": "200", "contentRating": "safe", "tags": ["Action", "Adventure", "Fantasy"],
  "description": "…", "cover": "/api/manga/image?url=…",
  "authors": ["Lee Eun-Jae (이은재)"], "artists": ["Dubu (Redice Studio)"], "altTitles": ["Solo Leveling"],
  "chapters": [{ "id": "f7d2cb75-83b2-426b-bdbd-032870c30abb", "chapter": "15", "volume": "1",
    "title": "Dungeon Boss", "pages": 0, "group": null, "publishAt": "2023-09-05T17:14:12+00:00",
    "externalUrl": "https://www.webnovel.com/comic/15227640605485101/45196977385821028" }] }
```

Post-processing `[code]`: duplicate chapter numbers collapse to one entry preferring the **hosted** copy
(`pages > 0 && !externalUrl`); order is descending by parsed number, non-numeric last; a feed failure leaves
`chapters: []` and still returns 200. `pages: 0` + `externalUrl` = a licensed chapter — link out, never render
(§24.4). Cache `s-maxage=300`, swr 900; `400 {"error":"Invalid manga id"}`; `502` on failure.

**`GET /api/manga/chapter/[id]`** — reader payload.

```json
{ "chapterId": "77fc6e02-a381-411d-ace6-4c00deacadb4", "mangaId": "a77742b1-…", "mangaTitle": "Chainsaw Man",
  "chapter": "97", "volume": "11", "title": "Love, Love, Chainsaw.",
  "pages": ["/api/manga/image?url=https%3A%2F%2Fcmdxd98sb0x3yprd.mangadex.network%2Fdata%2F554b6d5b….png"],
  "saverPages": ["/api/manga/image?url=…%2Fdata-saver%2F…"],
  "prev": { "id": "7259bb55-…", "chapter": "96" }, "next": { "id": "ce88a93f-…", "chapter": "230" } }
```

Four upstream calls `[code]`: `/chapter/{id}?includes[]=manga` (600) → `/manga/{mangaId}` (3600) →
`/at-home/server/{chapterId}` (`no-store`) → `/manga/{mangaId}/feed` ascending (600) for prev/next restricted to
hosted chapters. `prev`/`next` are `null` at the ends **and** when the feed fails; all page URLs are proxied
absolute paths. Cache `no-store` by design, because `at-home` nodes rotate. Live: 23 pages and 23 `saverPages` for
ch. 97, `prev` 96, `next` 230. Errors: `400 {"error":"Invalid chapter id"}`; `502` when pages are unavailable.

**`GET /api/manga/image`** — image proxy and MangaDex host allowlist. One param, `url`, absolute http(s) on
`uploads.mangadex.org`, `mangadex.org` or `mangadex.network` (exact host or subdomain) `[code]` `[live]`.

Upstream request: `User-Agent: AnimeAttack/1.0 (https://github.com/slacktack/anime-attack)`, `Accept: image/avif,
image/webp, image/apng, image/*,*/*;q=0.8`, `Referer: https://mangadex.org/`, 15 s timeout, `no-store`. Accepted
only if `ok`, `Content-Type` starts with `image/`, and `Content-Length != 0`. A failing `*.mangadex.network` URL
is retried once as `https://uploads.mangadex.org{same path and query}` `[code]`.

Response `[code]` `[live]`: `Content-Type` (default `image/jpeg`), `Cache-Control: public, max-age=86400,
s-maxage=31536000, stale-while-revalidate=604800`, `Access-Control-Allow-Origin: *`,
`X-Content-Type-Options: nosniff`, `Content-Disposition: inline`. Errors `400 {"error":"Missing image url"}` /
`"Invalid image url"` / `"Host not allowed"`, `502 {"error":"Image unavailable"}`. A live page fetch returned
`200 image/png`, 767 192 bytes, 822×1200.

## 10. `GET`/`HEAD /api/proxy/media`

The security boundary of the streaming path: it fetches with a `Referer` a browser cannot forge, rewrites HLS,
and re-serves with permissive CORS.

| Param | Default | Notes |
| --- | --- | --- |
| `url` | required | absolute http(s); missing/invalid → `400` |
| `ref` | origin of `url` | sent upstream as `Referer`; the client always sends `https://megavid.buzz/` `[code]` |
| `mode` | `smart` | `full` proxies every variant and segment; `smart` proxies playlist lines always and segments unless the host is in `DIRECT_SEGMENT_HOSTS` |

Pipeline `[code]`: validate → fetch (Chrome 131 UA, `Referer: ref`, `Accept: */*`, `Range` forwarded,
`redirect: "follow"`, `no-store`, 25 s) → non-OK upstream becomes `502` (`404` preserved) →

1. **Playlist detection** — `Content-Type` matches `/mpegurl/i`, path ends `.m3u8`, query has `t.m3u8`/`v.m3u8`,
   final URL ends `.m3u8`, **or** the first bytes are `#EXTM3U` (this catches the `/vid/` family, which can be
   labelled `text/vnd.trolltech.linguist`).
2. **Rewrite** — every `URI="…"` attribute and every non-comment line is absolutised against the post-redirect
   URL and replaced with `/api/proxy/media?url=<abs>&ref=<ref>&mode=<mode>`. Masters always go through the
   proxy; media playlists follow `mode`.
3. **Subtitles** — a `.vtt/.srt/.ass/.ssa/.txt` URL is buffered and converted to WebVTT.
4. **Everything else** streams through, preserving `Content-Range`, `Accept-Ranges` and `206`.

| Body | Headers |
| --- | --- |
| Playlist | `Content-Type: application/vnd.apple.mpegurl`, `Cache-Control: public, s-maxage=4, stale-while-revalidate=10` |
| Subtitle | `Content-Type: text/vtt; charset=utf-8`, `Cache-Control: public, max-age=3600, s-maxage=3600` |
| Segment | upstream type, `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400` |

All responses carry `Access-Control-Allow-Origin: *`,
`Access-Control-Allow-Headers: Range, Content-Type`,
`Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges` `[code]`.

Verified `[live]`: a `/vid/` master came back `200 application/vnd.apple.mpegurl` with every variant rewritten to
`http://localhost:3100/api/proxy/media?url=…`; the first segment returned `200 video/mp2t` (3 047 480 bytes, sync
byte `0x47`); `HEAD` returned the same type with `max-age=3600` but ignores `ref`, always sending
`Referer: https://megavid.buzz/` `[code]`.

Client escalation `[code]`: `WatchView.tsx` builds that URL for both the stream and each subtitle `file`, and on a
fatal player error flips to `mode=full` before advancing to the next provider.

## 11. `/api/proxy/aniwatch` and `/api/proxy/quotes`

**`/api/proxy/aniwatch`** — GET proxy for the browser-side aniwatch path (`lib/anime/aniwatch.ts` switches on
`typeof window !== "undefined"`) `[code]`. Params `url` (required, `400 {"error":"Missing url parameter"}`) and
`ref` (default `https://aniwatchtv.by/`); forwards `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` — the
**short** UA, deliberately: Google Video `videoplayback` returns `403` to the full Chrome UA string and `206` to this
one (reproduced 4/4) `[live]`, while megavid accepts either on `/vid/` masters and `/sub/` subtitles `[live]`; the
handler also accepts `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
AppleWebKit/537.36`, returns JSON when the upstream type contains `application/json` and otherwise passes body and
type through. Headers: `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600, s-maxage=3600,
stale-while-revalidate=86400` `[code]` `[live]`; `502` on throw. There is **no host allowlist**.

**`/api/proxy/quotes`** — `https://animechan.io/api/v1/random`, 4 s timeout, mapped from `data.anime.name`,
`data.character.name`, `data.content`; on any failure a random entry from a hard-coded set of 10 quotes is
returned with the same shape `[code]`.

```json
{ "anime": "One Piece", "character": "Monkey D. Luffy", "quote": "I don't want to conquer anything…" }
```

`Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600` on success, `max-age=60` on fallback.
Live: animechan returns **404** on `/api/v1/random`, `/api/v1/quotes` and `/api/v1/quotes/random`, so the route
currently always serves a fallback (still `200`) `[live]`.

## 12. `POST /api/ai`

Spoiler-aware companion: Gemini 2.5 Flash behind a same-origin gate and a rotating key pool.

| Field | Type | Notes |
| --- | --- | --- |
| `task` | enum | `summary \| catchup \| chat \| character \| charfacts \| charquiz \| recommend` |
| `animeTitle` / `ceiling` | string 1–200 / int 0–100000 | title for the system prompt; last watched episode, `0` = no spoilers at all |
| `question` / `characterName` / `context` | string ≤1000 / ≤200 / ≤5000 | `chat` / character tasks / reference text |

```json
{ "text": "Ready for a thrilling ride?\n\nWhat if you could judge the world with a single notebook? …" }
```

`[code]`: the `Origin` (else `Referer`) host must equal the request host, else `403 {"error":"forbidden"}` — a
request with neither header is allowed, which is why `curl` succeeds. Invalid body → `400 {"error":"invalid body"}`,
upstream failure → `500 {"error":"ai failed"}`. Upstream
`generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` at `temperature 0.7`,
`maxOutputTokens 800`; key pool `GEMINI_API_KEYS` (comma-separated) else `GEMINI_API_KEY`, round-robin via a module
cursor with each key tried once, and no keys → `500`. Live: `200` with generated text; `Origin: https://evil.example`
→ `403 {"error":"forbidden"}` `[live]`.

## 13. `lib/client/api.ts`

Every UI read goes through these helpers, which unwrap the envelope and throw `Error(json.error)` on non-OK `[code]`:

| Function | HTTP call | Returns |
| --- | --- | --- |
| `fetchDiscover(kind)` | `GET /api/anime/discover?kind=` | `AnimeSummary[]` |
| `fetchSearch(q)` | `GET /api/anime/discover?kind=search&q=` | `AnimeSummary[]` |
| `fetchBrowse(f)` | `GET /api/anime/discover?kind=browse&genre&year&format&status&sort` | `AnimeSummary[]` |
| `fetchAnimeDetail(id)` | `GET /api/anime/{id}` | `AnimeDetailPayload` |
| `fetchWatchEpisodes(malId)` | `GET /api/anime/episodes?mal=` | `WatchEpisodesResponse` |
| `fetchCharacters(page, q)` | `GET /api/characters?page=&q=` | `CharacterCard[]` |
| `fetchCharacterFull(id)` | `GET /api/characters/{id}` | `CharacterFull` |
| `fetchSchedule()` | `GET /api/schedule` | `ScheduleEntry[]` |
| `fetchLatestEpisodes(page, perPage)` | `GET /api/anime/latest?page=&per_page=` | `AniwatchEpisode[]` |
| `fetchEpisodeSearch(q)` | `GET /api/anime/latest?q=` | `AniwatchEpisode[]` |

Two call sites bypass it `[code]`: `WatchView.tsx` → `GET /api/anime/source?slug&mal&ep&audio&provider&refresh`
(`no-store`, `retry: 1`) and `lib/ai/useAi.ts` → `POST /api/ai`; manga screens and the media proxy use raw
`fetch`/`<img>`/hls.js — a gap worth closing if `api.ts` is to be the single mobile contract.

## 14. Master table

| Endpoint | Purpose | Upstream | Cache TTL | Failure mode |
| --- | --- | --- | --- | --- |
| `GET /api/anime/discover` | trending / airing / movies / search / browse | AniList | 300 s, swr 900 | `502 {error, items:[]}` |
| `GET /api/anime/{id}` | anime + MAL id + relations + cast + recs | AniList ×5 | 600 s, swr 1800 | `400` bad id; sections degrade to `[]`; `502` if the main query fails |
| `GET /api/anime/episodes` | episode numbering + AniList entry | AniList + Jikan | 900 s, swr 3600 | Jikan down → generated numbering; `400` bad `mal` |
| `GET /api/anime/latest` | new-episode feed and feed search | aniwatch WP | 120 s, swr 600 | `502 {error, items:[]}` |
| `GET /api/anime/source` | resolve one playable stream | aniwatch page → megavid | `no-store` (90 s / 15 s in-process) | `missing`/`countdown`/`error` at 200; `404` unresolvable; `502` throw |
| `GET /api/characters` | character browse/search | AniList | 600 s, swr 1800 | `502 {error, items:[]}` |
| `GET /api/characters/{id}` | one character + 12 media | AniList | 3600 s, swr 86400 | `400`; `502` |
| `GET /api/schedule` | next 40 airings | AniList | 600 s, swr 1800 | `502 {error, items:[]}` |
| `GET /api/manga/search` | manga list / search | MangaDex `/manga` | 300 s, swr 900 | `502` |
| `GET /api/manga/{id}` | detail + chapter feed | MangaDex `/manga`, `/feed` | 300 s, swr 900 | `400`; feed failure → `chapters:[]`; `502` |
| `GET /api/manga/chapter/{id}` | reader pages + prev/next | MangaDex `/chapter`, `/at-home`, `/feed` | `no-store` | `400`; `502` when pages unavailable; nav `null` on feed failure |
| `GET /api/manga/image` | cover/page image proxy | MangaDex uploads + network | 86400 s, `s-maxage` 31536000 | `400` bad/host; `502` unavailable |
| `GET/HEAD /api/proxy/media` | HLS/segment/subtitle proxy | any media host | playlists 4 s; segments 86400 s; subs 3600 s | `400`; `502` (404 preserved) |
| `GET /api/proxy/aniwatch` / `proxy/quotes` | browser aniwatch proxy / random quote | aniwatch WP / animechan → static 10 | 3600 s (quotes 60 s on fallback) | `400`/`502` for aniwatch; quotes never fail |
| `POST /api/ai` | spoiler-safe AI text | Gemini 2.5 Flash | none | `403` cross-origin; `400`; `500` |

---

# Part II — Upstreams

## 15. AniList GraphQL

| Property | Value |
| --- | --- |
| Base | `https://graphql.anilist.co`, **POST only** — `GET` returns `404 {"errors":[{"message":"Not Found.","hint":"Use POST request to access graphql subdomain.","status":404}]}` `[live]` |
| Auth | none for public data `[code]` `[live]` |
| Headers | `Content-Type: application/json`, `Accept: application/json` `[code]` |
| Rate limit | `x-ratelimit-limit: 30`/min with `x-ratelimit-remaining`, exposed via `access-control-expose-headers` `[live]` |
| Cache in app | `revalidate: 300` (shared client), `3600` (episodes lookup) `[code]` |
| Grade | **A** — every probe `200`; the most stable dependency in the app |

Errors `[code]`: non-OK status throws `AniList {status}`; a `200` carrying `errors` also throws
(`"AniList query error"`), so GraphQL errors never surface as silent nulls.

`MEDIA_FIELDS` (`lib/anime/queries.ts`):

```graphql
id title { english romaji native } coverImage { large medium }
bannerImage format averageScore seasonYear episodes status genres
nextAiringEpisode { episode airingAt }
studios(isMain: true) { nodes { name } }
```

`anilist-extra.ts` keeps a narrower copy without `nextAiringEpisode`/`studios` for browse and character media.

| Query | Variables | Shape | Used by |
| --- | --- | --- | --- |
| `TRENDING` / `TOP_AIRING` / `POPULAR_MOVIES` | — | `Page(perPage: 20) { media(…) }` with `sort: TRENDING_DESC`, `status: RELEASING + POPULARITY_DESC`, `format: MOVIE + POPULARITY_DESC` | discover `trending` / `airing` / `movies` |
| `SEARCH` | `$q, $page` | `media(search: $q, sort: SEARCH_MATCH)`, perPage 20 | discover `search`, slug resolution |
| `DETAILS` | `$id` | `Media(id:)` + `MEDIA_FIELDS` + `description(asHtml:false)` | `/api/anime/[id]` |
| `CHARACTERS` | `$id` | `characters(sort: ROLE, perPage: 25) { edges { role node voiceActors(language: JAPANESE) } }` | `/api/anime/[id]` |
| `RECOMMENDATIONS` | `$id` | `recommendations(sort: RATING_DESC, perPage: 20) { nodes { mediaRecommendation } }` | `/api/anime/[id]` |
| `RELATIONS` | `$id` | `relations { edges { relationType node { … } } }` | season switcher |
| `EPISODES_BY_MAL` (inline) | `$idMal` | `Media(idMal:, type:) { … episodes seasonYear nextAiringEpisode }` | `/api/anime/episodes` |
| `BROWSE_ANIME` | `$genre,$year,$season,$format,$status,$sort` | `Page(perPage: 30) { media(type: ANIME, …) }` | discover `browse` |
| `BROWSE_CHARACTERS` | `$page, $search` | `Page(perPage: 30) { characters(sort: FAVOURITES_DESC, search:) }` | `/api/characters` |
| `CHARACTER_FULL` | `$id` | `Character(id:) { … media(sort: POPULARITY_DESC, perPage: 12) }` | `/api/characters/[id]` |
| `SCHEDULE` | `$page` | `Page(perPage: 40) { airingSchedules(notYetAired: true, sort: TIME) }` | `/api/schedule` |
| `GENRE_COLLECTION` | — | `GenreCollection → string[]` | `BrowseView.tsx` server-side, **no HTTP route** |
| `ANIME_EXTRAS` | `$id` | `Media(id:) { idMal coverImage { color } }` | detail `malId`/`accentColor`, slug resolution |

Browse query verbatim (`anilist-extra.ts`) — absent filters are omitted, never sent as `null`, and `sort`
always defaults to `["POPULARITY_DESC"]` `[code]`:

```graphql
query ($genre: String, $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
  Page(perPage: 30) {
    media(type: ANIME, genre: $genre, seasonYear: $year, season: $season,
          format: $format, status: $status, sort: $sort) { id title { english romaji native } … }
  }
}
```

Response shape (abridged) and mapping `[code]`: `title` falls back `english → romaji → native → "Untitled"`;
`cover` falls back `coverImage.large → medium → ""`; `averageScore` becomes `score/10`.

```json
{ "data": { "Page": { "media": [{ "id": 195604,
  "title": { "english": "Black Clover Season 2", "romaji": "Black Clover 2nd Season", "native": null },
  "format": "TV", "averageScore": 87, "seasonYear": 2026, "episodes": null, "status": "RELEASING",
  "genres": ["Action", "Adventure", "Fantasy"],
  "nextAiringEpisode": { "episode": 5, "airingAt": 1793550000 },
  "studios": { "nodes": [{ "name": "Studio Pierrot" }] } }] } } }
```

## 16. Jikan

| Property | Value |
| --- | --- |
| Base | `https://api.jikan.moe/v4` |
| Endpoint used | `GET /anime/{malId}/episodes` — the only Jikan call in the repo `[code]` |
| Fields read | `data[].mal_id`, `data[].title`, `data[].filler` `[code]` |
| Headers / cache | `Accept: application/json`; `revalidate: 3600`; `AbortSignal.timeout(4000)`; 5 min negative cache per MAL id `[code]` |
| Rate limit | 3 req/s and 60 req/min per IP as published `[unverified]` — host unreachable |
| Grade | **F** on 2026-10-31; **D** historically |

Live `[live]`: **six consecutive attempts returned `000`** after the full 20 s timeout; DNS resolves
(`135.181.39.91`) but the TLS handshake never completes, reproducing the "`000` failures" of the earlier draft
exactly. Consequence: every sampled `/api/anime/episodes` response reported `source: "generated"` `[live]` —
AniList supplied totals and the app synthesised numbering, with a 500-episode floor for a `RELEASING` show that
has no announced total (§4). Clients must not assume `episodes[].title` is non-null or that `source === "jikan"`.

## 17. Kitsu

| Property | Value |
| --- | --- |
| Base | `https://kitsu.io/api/edge` |
| Endpoints | `GET /anime?filter[text]={q}&page[limit]=20`, `GET /anime?sort=-userCount&page[limit]=20` `[code]` |
| Headers | **`Accept: application/vnd.api+json` is mandatory** — without it `406 {"errors":[{"title":"Not acceptable","detail":"All requests must use the 'application/vnd.api+json'…"}]}`; with it `200` `[live]` |
| Fields read | `attributes.titles.en`, `canonicalTitle`, `posterImage.original\|large`, `coverImage.original`, `subtype`, `averageRating`, `startDate` `[code]` |
| Grade | **B** — works, unused in production |

Purpose: a secondary discovery/cross-check path only. `lib/anime/kitsu.ts` is imported by its test alone — no
route, no component `[code]`. `score` maps as `Math.round(averageRating)/10`, the same 0–10 scale as AniList.

## 18. Quotes (animechan)

`https://animechan.io/api/v1/random`, no auth, `Accept: application/json`, 4 s timeout, fields
`data.anime.name`, `data.character.name`, `data.content` `[code]`. Live: `404` on `/api/v1/random`, `/api/v1/quotes`
and `/api/v1/quotes/random`, while the host root serves `200` HTML `[live]`. Grade **F** — decorative widget only,
permanently served from the bundled 10-quote fallback.

## 19. aniwatch WordPress API

| Property | Value |
| --- | --- |
| Base / API | `https://aniwatchtv.by`, `https://aniwatchtv.by/wp-json/wp/v2` `[code]` |
| Auth | none (public WordPress REST) |
| Headers | `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` + `Referer: https://aniwatchtv.by/` per the code's requirement `[code]`; `[live]` both a browser UA and an empty UA returned `200`, so the gate was not enforced that day — send both anyway |
| Cache | `revalidate: 300`; browser calls route through `/api/proxy/aniwatch` `[code]` |
| Grade | **B+** — fast and reliable now, but a third-party WordPress theme whose slugs and player paths can change |

| Call | Purpose |
| --- | --- |
| `/posts?page=&per_page=&orderby=date&order=desc` | latest-episode feed (`per_page` max 100 upstream, route clamps to 30) |
| `/posts/{id}` | one episode post |
| `/posts?categories={id}&per_page=100&orderby=date&order=desc` | all episodes of a series (`EpisodeList.tsx`) |
| `/posts?search={q}` | **returns 0 rows** on this install `[live]`; no longer used by the app `[code]` |
| `/posts?slug={slug}&per_page=1` | slug → post title; exact slugs still answer `200` with one row `[live]`, but the code treats it as unreliable and derives the title from the slug instead `[code]` |
| `/categories?page=&per_page=100&orderby=count&order=desc` | series list |
| `/categories?search={term}&per_page=10` | series lookup — the term **must be hyphenated** (`one-punch-man`); `one%20punch%20man` returns 0 rows `[live]`. Used by `AnimeDetail.tsx` (with a loosening ladder) and by `searchPosts()` for feed search |

The raw payload is far larger than what is kept — `guid`, `yoast_head` and `content` are discarded;
`WpPostRawSchema` reads `id, date, slug, link, title.rendered, categories, tags` and emits:

```json
{ "id": 35890, "date": "2026-10-31T02:16:00", "slug": "…-episode-5-english-subbed",
  "title": "… Episode 5 English Subbed", "link": "https://aniwatchtv.by/…/",
  "categoryIds": [2493], "tags": [] }
```

**Latest-episode mapping and its limit.** slug → `/api/anime/source?slug=…` → megavid MAL id. The category
taxonomy is not a catalogue: `categories?search=one piece` returned `(105, count 21, "One Piece")` — 21 indexed
posts for a 1100+ episode series `[live]`. That is why navigation comes from AniList/Jikan (§4) and this feed is
only "new episodes" plus "which slug to open".

## 20. Streaming pipeline: aniwatch → player → megavid

Verified chain, executed end-to-end for Death Note ep. 1 `[live]`:

```
1. GET https://aniwatchtv.by/{slug}/            200 text/html (~204 KB)
2.   first <iframe src> = https://aniwatchtv.by/wp-content/themes/animestream-child/player/?source=embed&url=<opaque token>
3. GET that player page                         200 text/html (~9 KB)
4.   player page embeds <iframe src="https://megavid.buzz/mal/1535/1/sub">
5. GET https://megavid.buzz/mal/{mal}/{ep}/{sub|dub}/source?axsv={provider}  200 JSON → /api/proxy/media
```

Two consequences of step 2: the iframe `src` no longer carries a megavid URL (the `url=` value is an opaque
token), so scraping only works because step 3 embeds it; and if step 3 changes, `resolveTargetFromSlug()` throws
and the route falls back to `resolveSlugToMal()` `[code]`. A second indirection, `player/?source=blogger` →
JW Player → signed Google Video MP4, is what `/api/anime/source` uses as its last resort for episodes megavid does
not carry (`type: "mp4"`, `provider: "aniwatch"`, §6) `[code]`; only the token form was observed playing `[live]`.

Source JSON contract `[live]` (Death Note ep. 1, `axsv=loli`):

```json
{ "status": "ok",
  "source": "https://cp.megavid.buzz/hls/1e810e75-bc54-4101-8038-e891e23ce7ff/playlist.m3u8",
  "tracks": [ { "file": "https://megavid.buzz/sub/…/3d69e3d8….vtt", "label": "English",
                "kind": "captions", "default": true },
              { "file": "https://megavid.buzz/sub/…/thumbnails.vtt", "label": "", "kind": "captions",
                "default": false } ],
  "mega": true, "animex": false, "providers": [], "chapters": [], "type": "hls" }
```

| Field | Meaning | Observed variation |
| --- | --- | --- |
| `status` | `ok \| missing \| countdown \| error` | only `ok` and `missing` reproducible |
| `source` | master or MP4 URL | `cp.megavid.buzz/hls/{uuid}/playlist.m3u8` (mega) or `megavid.buzz/vid/{token}/…` (vid family) |
| `type` | `hls \| mp4` | **absent** on the `/vid/` family, `"hls"` on the `cp.` family; `mega.ts` defaults to `"hls"` unless exactly `"mp4"` `[code]` |
| `tracks` | subtitle/thumbnail WebVTT | 0–37 entries; `label` may be `""`, `kind` is `captions` |
| `mega` | `cp.megavid.buzz` family | `true` for loli on most titles |
| `animex` | `s-90.megavid.se` family | `true` for zuna/yuki/sora/nero — all dead |
| `providers` | alternatives | `[]` on mega responses, 5 entries on animex responses (`zuna, yuki, sora, loli, nero` with tips like `"Sub and dub, HLS streams"`) |
| `chapters` | intro/outro markers | `[]` on loli; animex carried `Intro 0–85`, `Outro 1286–1357` |
| `provider` / `message` / `iframeUrl` | answering provider / reason / countdown embed | `provider` on animex only; `iframeUrl` only with `countdown` `[code]`, not reproduced. `/api/anime/source` can also answer with `provider: "aniwatch"` and `type: "mp4"` (mirror fallback, §6) |

Provider order `PROVIDER_ORDER = ["loli"]` — every other `axsv` value returns `status:"ok"` pointing at the dead
`s-90.megavid.se` host, so keeping them only added 3–9 s of timeout latency per failure `[code]`. A pinned
`?provider=` still goes first, then `PROVIDER_ORDER`. A candidate must be `status === "ok"` with a `source` that
passes `isValidPlaylist()` — a `Range: bytes=0-512` fetch whose body starts with `#EXTM3U` `[code]`. Measured for
Death Note ep. 1 sub `[live]` (before the list was trimmed to `loli`):

| Provider | `status` | `mega`/`animex` | `source` host | Usable |
| --- | --- | --- | --- | --- |
| `loli` | `ok` | true/false | `cp.megavid.buzz` | **yes** |
| `zuna` | `ok` | false/true | `s-90.megavid.se` (NXDOMAIN) | no — playlist probe fails |
| `yuki` | `ok` | false/true | `s-90.megavid.se` | no |
| `sora` | `ok` | false/true | `s-90.megavid.se` | no (advertised in `providers`, never in `PROVIDER_ORDER`) |
| `nero` | `ok` | false/true | `s-90.megavid.se` | no |

**`loli` is the only working provider.** On `sub`, `status: "missing"` short-circuits the loop (no point trying
other providers for a nonexistent episode); on `dub` it continues so a provider with a dub track can still answer
`[code]`. Timeouts and caches `[code]`: 12 s per fetch, `no-store`; source cache 90 s (30 s countdown, 15 s
failure); slug target 10 min; slug→MAL 30 min including negatives; `filterTracks()` DNS-checks up to 12 subtitle
hosts at 1.5 s each and drops dead ones. Total exhaustion throws
`"Every stream provider is unavailable right now. Try again in a moment."` → `502`.

## 21. The referer/CORS gate

An earlier draft claimed `/vid/` playlists and segments return `403` without a `Referer`. What is observable
`[live]` is narrower: the trigger is the **`Origin` header**, i.e. a genuine cross-origin browser request:

| Request shape | `/vid/…/master.m3u8` | `/vid/…/seg-f1-00000.jpg` | `/sub/…/en.vtt` |
| --- | --- | --- | --- |
| bare `curl` | 200 | 200 | 200 |
| `Origin: http://localhost:3100` | **403** | **403** | **403** |
| `Origin` + `Referer: https://megavid.buzz/` | 200 | 200 | 200 |
| `Referer: http://localhost:3100/` only | 200 | 200 | 200 |
| `Sec-Fetch-Mode: cors` + `Sec-Fetch-Site: cross-site` only | 200 | — | — |

Response headers on those endpoints `[live]`:

```
access-control-allow-origin: https://megavid.buzz      ← pinned, not *
access-control-allow-headers: *
content-type: application/vnd.apple.mpegurl   (playlists) | video/mp2t (segments, any extension)
cache-control: public, max-age=14400          (master playlist)
```

Two independent blocks — a 403 when `Origin` is present, and an `ACAO` naming only megavid — and a server-side
proxy defeats both simply by not sending `Origin`.

**The `/vid/` master playlist** `[live]`: `#EXT-X-STREAM-INF` entries named `1080p` (BW 5500000), `720p`
(BW 2800000) and a 360p variant on some titles; variants are 354-segment VOD playlists whose segment extensions
are **obfuscated** — one playlist contained `.jpg, .html, .js, .css, .ico, .png, .txt, .webp` — yet every segment
is `video/mp2t` starting with sync byte `0x47`. Never infer media type from the extension and never filter by
suffix.

**The `cp.`/`cdn.` family is permissive** `[live]`:

| Host | `ACAO` | With `Origin` | Segment `Content-Type` |
| --- | --- | --- | --- |
| `cp.megavid.buzz` (master + variants) | `*` | 200 | `application/vnd.apple.mpegurl` |
| `cdn.megavid.buzz` (`.ts` segments) | `*` | 200 | **`text/vnd.trolltech.linguist; charset=utf-8`** — body is MPEG-TS |

`cdn.megavid.buzz` also exposes `access-control-allow-methods: GET, HEAD, OPTIONS` and
`access-control-expose-headers: content-length, content-range, accept-ranges`. Technically browser-fetchable;
the bogus `Content-Type` is harmless because hls.js reads bytes.

**`DIRECT_SEGMENT_HOSTS`** in `proxy/media/route.ts` is `["echovideo.to"]` — hosts believed to serve segments with
permissive CORS; everything else is proxied even in `smart` mode, because megavid-family hosts reject direct
cross-origin segment requests `[code]`. `echovideo.to` has **no DNS record** `[live]`, so the list currently
whitelists nothing that exists and smart mode proxies every segment. That is the correct default given the table
above: the only cost is throughput, and the alternative is 403s or CORS errors in the browser. Playlist lines
(including `URI="…"` attributes such as `#EXT-X-MAP`) are rewritten in **both** modes; `mode` only governs
segments — `smart` proxies a segment unless its host is listed, `full` proxies all of them.

### Verified end-to-end: aniwatch mirror fallback `[live]`

MAL `40866` (the OPM S3 fixture that megavid answers `{"status":"missing","code":404}`) resolves through the
mirror:

```
GET /api/anime/source?slug=one-punch-man-season-3-episode-1-english-subbed&mal=40866&ep=1&audio=sub
-> {"status":"ok","type":"mp4","provider":"aniwatch","source":"https://rr2---sn-…googlevideo.com/videoplayback?…"}

GET /api/proxy/media?url=<that>&ref=https://megavid.buzz/&mode=smart   (Range: bytes=0-8191)
-> 206, content-type: video/mp4, content-range: bytes 0-8191/77051410, magic ftypmp42
```

Caveats: single quality (`itag=18`, 360p), the URL is signed and expiring (`expire=`), it carries
`ip=`/`mip=`/`ipbypass=yes`, and there are **no CORS headers**, so it must be proxied. The same request also
proves the proxy UA constraint below: the full Chrome UA yields `403` on `videoplayback`.

## 22. Subtitle tracks

| Aspect | Detail |
| --- | --- |
| Source | `tracks[]` in the megavid source JSON `[code]` `[live]` |
| Mega-family host | `https://megavid.buzz/sub/{token}/{video-token}/{name}.vtt`, served `text/vtt`, `ACAO: https://megavid.buzz` `[live]` |
| Gate is path-specific | Measured 2026-10-31 `[live]`: `/vid/…seg-*.jpg` → **200 bare**, **403 with a foreign `Origin`**, 200 with megavid `Origin`+`Referer`; `/sub/…vtt` → **403 bare**, **403 with a foreign `Referer`**, 200 with a megavid `Origin` **or** `Referer`; `cp./cdn.megavid.buzz` → ungated 200 |
| Labels / thumbnails | `English`, `Arabic`, `Portuguese (Portuguese - (Brazilian))`, `Spanish (Spanish - (LA))`, often `""`; a second `captions` entry points at `thumbnails.vtt` and must stay out of the subtitle menu `[code]` `[live]` |
| Animex-family host | `https://s-90.megavid.se/uwu/…/asset.txt` — **NXDOMAIN**, every track dead `[live]` |
| Dead hosts / client | `filterTracks()` drops unresolvable hosts so a dead CDN never breaks playback, and `WatchView` rewrites every `track.file` through `/api/proxy/media` (smart) `[code]` |
| SRT → VTT | the proxy buffers `.vtt/.srt/.ass/.ssa/.txt`, strips a BOM, returns it unchanged if it starts with `WEBVTT`, else converts `HH:MM:SS,mmm` → `HH:MM:SS.mmm` and prepends `WEBVTT\n\n` `[code]` |
| Limit | only the timing separator is converted — ASS/SSA `Dialogue:` lines are not turned into cues, so an `.ass` input yields a valid but empty WebVTT `[code]` |

Verified `[live]`: the Death Note ep. 1 English track returned `200 text/vtt`, 21 049 bytes, starting
`WEBVTT\n\n00:02:07.600 --> 00:02:08.520`; the same URL with `Origin` returned `403`.

## 23. Alternative source family: megaplay + anikoto

Evaluated as a second pipeline; not wired into the app's routes, but the better architecture for a new client
because it exposes JSON instead of HTML.

| Property | Value |
| --- | --- |
| Base | `https://anikotoapi.site` `[live]`; auth: none observed `[live]` |
| Domains advertised | `anikoto_domains: ["anikototv.to", "anikoto.cz"]` in every payload; both resolve `[live]` |
| Catalogue | `pagination.total: 9116`, `total_pages: 92` at `per_page=100` `[live]` |
| Rate limit | 60 req / 120 s `[unverified]` |
| Posters | `cdn.anipixcdn.co` `[live]`; the apex `anipixcdn.co` has no DNS record `[live]` |
| Grade | **B** — reachable and self-describing, but episode data looked stale (newest sampled `updated_at` was 2025-02-22 and 2024-10-18) |

| Call | Shape |
| --- | --- |
| `GET /recent-anime` | `{ ok, anikoto_domains: [...], data: [...], pagination: { page, per_page, total, total_pages } }` |
| `GET /series/{id}` | `{ ok, anikoto_domains, data: { anime: {…}, episodes: […] } }`; unknown id → `404 {"ok":false,"error":"Series not found","code":"not_found"}` `[live]` |
| `GET /` | HTML landing page, `200` `[live]` |

```json
{ "anime": { "id": 2, "title": "Loner Life in Another World", "slug": "loner-life-…", "mal_id": "57891",
             "ani_id": "173693", "rating": "PG-13", "status": "Finished Airing", "year": 2024,
             "score": "6.23", "episodes": "12",
             "poster": "https://cdn.anipixcdn.co/thumbnail/63ea2c642aaee001d818604fe1d9a811.jpg" },
  "episodes": [{ "id": 111982, "title": "Loner with the Worst Skills", "number": 1,
                 "episode_embed_id": "128280", "updated_at": "2025-02-22 20:20:48",
                 "embed_url": { "sub": "https://megaplay.buzz/stream/s-2/128280/sub",
                                "dub": "https://megaplay.buzz/stream/s-2/128280/dub" } }] }
```

`mal_id`/`ani_id` make this family mappable onto the app's MAL-based pipeline. **megaplay** `[live]`: pattern
`https://megaplay.buzz/stream/s-2/{episodeEmbedId}/{sub|dub}`, no redirect, no auth, plain UA — but every sampled
id (`128280`, `105621`, bare `s-2/128280`, `s-2/1/sub`) returned `200 text/html` with an **error page**
(`<title>Error - MegaPlay</title>`, 3 545 bytes, no `.m3u8`). HTTP 200 is therefore not a success signal there and
playback extraction stays `[unverified]`; expired embed ids are the likelier reading than a dead service.

## 24. MangaDex

| Property | Value |
| --- | --- |
| Base / uploads / data | `https://api.mangadex.org` / `https://uploads.mangadex.org` / `https://{node}.mangadex.network` |
| Auth / headers | none; `User-Agent: AnimeAttack/1.0 (https://github.com/slacktack/anime-attack)`, `Accept: application/json` `[code]` |
| Rate limit | `x-ratelimit-limit: 40`/min plus `x-ratelimit-remaining` and `x-ratelimit-retry-after` `[live]` |
| Cache in app | `revalidate: 300` default, `600` chapter/feed, `3600` title, `no-store` `/at-home` `[code]` |
| Grade | **A−** — stable and well documented, with a strict validator that fails loudly on wrong parameter names |

**The list-vs-feed language parameter (critical)** `[live]`:

| Endpoint | Correct | Wrong result |
| --- | --- | --- |
| `GET /manga` (list/search) | `availableTranslatedLanguage[]=en` → `200` | `translatedLanguage[]=en` → **`400`** `{"result":"error","errors":[{"status":400,"title":"validation_exception","detail":"Error validating : The property translatedLanguage is not defined and the definition does not allow additional properties"}]}` |
| `GET /manga/{id}/feed` | `translatedLanguage[]=en` | `availableTranslatedLanguage[]` is not a feed parameter `[code]` |

`hasAvailableChapters=true` additionally restricts the list to titles with at least one readable chapter —
`/manga?limit=1&availableTranslatedLanguage[]=en&hasAvailableChapters=true` → `200` `[live]`; without it, licensed
titles with zero hosted chapters dominate results.

| Call | App params |
| --- | --- |
| `GET /manga` | `limit=24`, `offset=page*24`, `contentRating[]=safe`, `contentRating[]=suggestive`, `includes[]=cover_art`, `availableTranslatedLanguage[]=en`, optional `hasAvailableChapters`, `title`, `order[…]` `[code]` |
| `GET /manga/{id}` | `includes[]=cover_art&author&artist` `[code]` |
| `GET /manga/{id}/feed` | `limit=500`, `translatedLanguage[]=en`, `order[chapter]=desc\|asc`, `includeFutureUpdates=0` `[code]` |
| `GET /chapter/{id}` | `includes[]=manga`; `GET /at-home/server/{chapterId}` is `no-store` `[code]` |
| Covers / pages | `uploads.mangadex.org/covers/{mangaId}/{file}.512.jpg`, `{baseUrl}/data/{hash}/{file}` and `…/data-saver/…`, always via `/api/manga/image` `[code]` |

Chapter attributes `[live]`: `chapter, volume, title, pages, externalUrl, publishAt, readableAt,
translatedLanguage, isUnavailable, createdAt, updatedAt, version`.

```json
{ "result": "ok", "baseUrl": "https://cmdxd98sb0x3yprd.mangadex.network",
  "chapter": { "hash": "554b6d5bcece279f439171f5a7d428c3", "data": ["1-….png"], "dataSaver": ["1-….png"] } }
```

`baseUrl` rotates, which is why `/api/manga/chapter/[id]` is `no-store` and `/api/manga/[id]` is not. An unknown
chapter id gives `404 {"result":"error","errors":[{"title":"not_found_http_exception", …}]}` `[live]`.

**Licensed titles / external-only chapters** `[live]`: the entry survives, the pages do not — chapter rows carry
`pages: 0` plus a non-null `externalUrl` to the publisher, and `/at-home` returns `200` with `data: []`.

| Title | Chapters | Hosted (`pages > 0`) | External-only |
| --- | --- | --- | --- |
| Na Honjaman Level-Up (Solo Leveling) | 16 | 0 | 16 (all `webnovel.com`) |
| Sono Bisque Doll wa Koi o Suru | 220 | 0 | 220 |
| Chainsaw Man | 100 | **97** | 3 |

Rule the app already encodes: `pages: 0` + `externalUrl` → official link, never a reader request `[code]`.

## 25. Dead and rejected endpoints

All probed 2026-10-31 with a browser UA `[live]`.

| Service / host | URL | Status | Detail | Verdict |
| --- | --- | --- | --- | --- |
| Consumet | `api.consumet.org/anime/gogoanime/one-piece` | **301** | → `github.com/consumet/api.consumet.org…` | rejected, public instance retired |
| Anify | `anify.tv/api/anime` | **301** | redirects to itself (`/api/anime` → `/api/anime`), loop | rejected |
| AllAnime | `api.allanime.day/api?query=…` | **403** | Cloudflare `<title>Just a moment...</title>` | rejected, challenge-gated |
| AnimePahe | `animepahe.com/api?…` | 301 → **403** | apex → `animepahe.pw`, which 403s the API | rejected |
| Anitaku | `anitaku.bz` | **200** | reachable; `anitaku.to` has no DNS (`000`) | alive, unused |
| `s-90.megavid.se`, `echovideo.to` | any | **000** | `nodename nor servname provided, or not known` | **NXDOMAIN** — `s-90` is where every `animex` source points; `echovideo.to` remains in `DIRECT_SEGMENT_HOSTS`, hence that list whitelists nothing (it is kept only as a hook for a future ACAO-`*` CDN) |
| animechan / Jikan | `animechan.io/api/v1/random` **404** (host root HTML `200`) / `api.jikan.moe/v4/anime/1535/episodes` **000** | 404 / 000 | animechan's API is gone; Jikan's DNS is fine but TLS never completes in 20 s | animechan: bundled fallback. Jikan: degraded, generated numbering |
| `anipixcdn.co` apex | — | **000** | DNS failure; `cdn.anipixcdn.co` resolves | use `cdn.` only |

Only AniList, MangaDex and aniwatch WordPress answered consistently well throughout testing.

## 26. Verified title fixtures

AniList/MAL mappings re-queried live; playability probed against `megavid.buzz/mal/{mal}/{ep}/{audio}/source?axsv=loli`.

| Title | AniList | MAL | Episodes | Year | Notes |
| --- | --- | --- | --- | --- | --- |
| Black Clover (S1) / Season 2 | **97940 / 195604** | **34572 / 61967** | 170 / `null` | 2017 / 2026 | S1 is `FINISHED` and also appears in `discover?kind=trending`; S2 is `RELEASING` with no episode count yet |
| ONE PIECE | **21** | **21** | `null` | 1999 | ep. **650** and **1180** both verified playable via `loli` |
| One-Punch Man S1 / S2 / S3 | **21087 / 97668 / 153800** | **30276 / 34134 / 52807** | 12 each | 2015 / 2019 / 2025 | all verified playable: S1 on `cp.megavid.buzz` (19 tracks), S2/S3 on `megavid.buzz/vid/…` (`type` absent). The old "MAL 40866 missing" note used a **wrong id** — 52807 is correct |
| Your Name. | **21519** | **32281** | 1 (`MOVIE`) | 2016 | `/api/anime/episodes?mal=32281` → `isMovie: true`, one episode `"Movie"` |
| Death Note | **1535** | **1535** | 37 | 2006 | canonical per-episode fixture; sub and dub both `ok` on ep. 1 |
| Dragon Ball Super | **21175** | **30694** | 131 | 2015 | verified playable |
| Blue Box Season 2 | **189123** | **61323** | 12 | 2026 | 12-episode fallback fixture |

Non-anime fixtures `[live]`: manga `32d76d19-8a05-4db0-9fc2-e0b0648fe9d0` (Na Honjaman Level-Up, licensed) for
`pages: 0` + `externalUrl`; manga `a77742b1-befd-49a4-bff5-1ad4e6b0ef7b` (Chainsaw Man, 97 hosted chapters) and
its chapter `77fc6e02-a381-411d-ace6-4c00deacadb4` for the reader (23 pages, nav populated); aniwatch post `35890`
(latest feed) and slug `death-note-episode-1-english-subbed` for the full chain — the bare slug
`death-note-episode-1` is a 301; characters `17` (Naruto) and `40` (Luffy); anikoto series `2` (MAL 57891).

## 27. Failure playbook

| Symptom | Cause | Action |
| --- | --- | --- |
| "Every stream provider is unavailable" | all providers failed the playlist probe | wait, retry (failure cached 15 s only), then `refresh=1` or another episode |
| `status: "missing"` on sub | episode absent upstream | "not found"; on dub offer "watch in sub" — the client already does |
| `ok` but player stalls / no subtitles | segments blocked, or the track host is dead (`s-90.megavid.se`) | flip `mode=full`, then advance providers (`handleFatal`); subtitle loss from a dead host is expected, so never retry it in the player |
| `403` on a `/vid/`/`/sub/` URL, or missing segments | direct browser request (has `Origin`), or relative variant URLs | route everything through `/api/proxy/media` and never fetch these client-side; re-fetch playlists instead of caching them beyond 4 s |
| `source: "generated"` on episodes | Jikan slow/down | expected; render numbers without titles; respect the 5 min negative cache |
| AniList `429` | > 30 req/min | batch queries with GraphQL aliases (Appendix A); rely on `s-maxage` |
| MangaDex `400 validation_exception` | wrong language param | list → `availableTranslatedLanguage[]`, feed → `translatedLanguage[]` |
| Blank manga pages / image `502` | `/at-home` node rotated, external-only chapter, or dead node | re-request the chapter route (`no-store`); `pages.length === 0` → render `externalUrl`; images already retry `uploads.mangadex.org` |
| AI `403 forbidden` / same quote repeatedly | cross-origin caller / animechan 404 | AI is same-origin only, no token; quotes fall back to 10 bundled entries |
| `404` from `/api/anime/source` | slug → MAL failed | open the episode from the anime page (the message says so) |
| Stale feed | aniwatch params changed | `s-maxage=120` bounds it; verify with the wp-json probe |

Rules worth encoding in any client: (1) never treat HTTP 200 as success for `/api/anime/source` or megaplay —
read `status`/inspect the body; (2) never build a megavid URL client-side; (3) never fetch media directly, always
`/api/proxy/media`; (4) never cache `/api/anime/source` or `/api/manga/chapter/[id]`; (5) degrade, don't fail —
every metadata endpoint already substitutes an empty array or a generated list.

## 28. Mobile / APK reuse notes

**What must stay server-side:** aniwatch → megavid resolution (slug scraping, provider iteration, `#EXTM3U`
validation, DNS filtering, and a `Referer` the platform will not send); media proxying (`/vid/` and `/sub/` 403
any request carrying `Origin` and pin `ACAO` to megavid, and a client cannot strip its own `Origin`); aniwatch
HTML parsing (browser UA + a theme-specific player page); rate limiting (30 req/min AniList, 3 req/s Jikan, shared
across devices via one cache); manga images (rotating data hosts, allowlist and `uploads` fallback are server
policy); and AI keys (`GEMINI_API_KEYS` must never ship in an APK).

Minimum server surface for an APK: Part I minus the HTML-dependent pieces — `discover`, `[id]`, `episodes`,
`latest`, `source`, `characters`, `characters/[id]`, `schedule`, `manga/*`, `proxy/media`, `ai`.

**Headers and CORS.** `/api/proxy/media` is the only endpoint that must be cross-origin-reachable, and
`vercel.json` already adds `Access-Control-Allow-Origin: *`, `Allow-Headers: *`, `Allow-Methods: GET,HEAD,OPTIONS`
for it `[code]`. Every other endpoint sends no `ACAO`, so a WebView must be same-origin or the server needs an
allowlist for a native client; `/api/ai` rejects any foreign `Origin`/`Referer`; `/api/proxy/aniwatch` has **no host
allowlist** — add one before exposing it to untrusted clients, or the app becomes an open proxy.

**HLS.** Use hls.js (`^1.7.4`, as the web app does) or native HLS; never infer `.m3u8` from the URL, since
`/vid/` variants are `.m3u8` while segments are `.jpg`/`.js`/`.html`. Segments are MPEG-TS even when labelled
`text/vnd.trolltech.linguist` — sniff the bytes rather than trusting `Content-Type`. Keep the escalation ladder
`smart` → `full` → next provider → hard error, and persist progress per `malId:episode`
(`localStorage['anime:progress:{mal}:{ep}']`, cleared past 97 % `[code]`).

**Caching / budgets.** Client-side: `discover`/`manga` 5 min, `anime/[id]`/`characters`/`schedule` 10 min,
`characters/[id]` 1 h, `episodes` 15 min, `latest` ≤ 2 min, images 24 h; never persist `source` or chapter pages.
Upstream budgets: AniList 30/min and MangaDex 40/min `[live]`; Jikan 3/s and anikoto 60/120 s `[unverified]`.
Re-verify from the deployment region (`vercel.json` pins `bom1`) — megavid/Cloudflare behaviour is geography
sensitive.

## 29. Legal caveats

- **No hosted media.** Nothing here stores, transcodes or re-uploads video; the app resolves a third-party URL and
  hands the player a proxied copy. `megavid.buzz`, `megaplay.buzz` and `aniwatchtv.by` are independent services
  with their own terms — resolvable is not licensed, and jurisdiction matters.
- **The proxy is technical, not legal.** `/api/proxy/media` satisfies `Referer`/CORS requirements browsers cannot
  meet; it grants no licence and makes the deployer the party serving bytes.
- **MangaDex within its terms;** public, unauthenticated, rate-limited reads with an identifying `User-Agent` and
  `Referer: https://mangadex.org/` on images `[code]` — do not strip either. **Licensed manga = official links
  only:** `pages: 0` + `externalUrl` is the API's own signal to link out.
- **Secrets and attribution.** `GEMINI_API_KEYS` is quota-bearing and must stay server-side; metadata belongs to
  AniList and Jikan/MAL, so keep AniList links and MAL ids visible.

## Appendix A — re-running the checks

`npm run verify:apis` → `node scripts/verify-apis.mjs [baseUrl]` (default `http://localhost:3100`) asserts 18
internal endpoints plus the full HLS chain — master → variant → first segment, confirming the segment is proxied
rather than fetched directly. Exit 0 only when everything passes `[code]`.

```bash
# upstreams — one probe each (the full set is in the git history of this doc)
curl -s -o /dev/null -w 'anilist   %{http_code}\n' -X POST https://graphql.anilist.co \
  -H 'Content-Type: application/json' -d '{"query":"{Page(perPage:1){media(sort:TRENDING_DESC,type:ANIME){id}}}"}'
curl -s -o /dev/null -w 'jikan     %{http_code}\n' --max-time 20 https://api.jikan.moe/v4/anime/1535/episodes
curl -s -o /dev/null -w 'md-list   %{http_code}\n' 'https://api.mangadex.org/manga?limit=1&availableTranslatedLanguage%5B%5D=en'
curl -s -o /dev/null -w 'md-broken %{http_code}\n' 'https://api.mangadex.org/manga?limit=1&translatedLanguage%5B%5D=en'
curl -s -o /dev/null -w 'aniwatch  %{http_code}\n' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  -H 'Referer: https://aniwatchtv.by/' 'https://aniwatchtv.by/wp-json/wp/v2/posts?per_page=2&orderby=date&order=desc'
curl -s -H 'User-Agent: Mozilla/5.0' -H 'Referer: https://megavid.buzz/' \
  'https://megavid.buzz/mal/1535/1/sub/source?axsv=loli' | jq -c '{status,type,mega,animex,tracks:(.tracks|length)}'
curl -s https://anikotoapi.site/series/2 | jq -c '.data.episodes[0].embed_url'   # alternative family

# dead hosts — expect DNS failure (host: NXDOMAIN) / 301 / 403
host s-90.megavid.se echovideo.to anipixcdn.co
curl -s -o /dev/null -w 'consumet %{http_code}\n' 'https://api.consumet.org/anime/gogoanime/one-piece'
```

The gate isolation §21 rests on:

```bash
SRC='https://megavid.buzz/vid/<tok>/<tok>/master.m3u8'; SEG='https://megavid.buzz/vid/<tok2>/<tok2>/seg-f1-00000.jpg'
curl -s -o /dev/null -w 'bare %{http_code}\n' "$SRC"                                     # 200
curl -s -o /dev/null -w 'Origin %{http_code}\n' -H 'Origin: http://localhost:3100' "$SRC" # 403
curl -s -o /dev/null -w '+ref %{http_code}\n' -H 'Origin: http://localhost:3100' -H 'Referer: https://megavid.buzz/' "$SRC"  # 200
curl -s -o /dev/null -w 'seg Origin %{http_code}\n' -H 'Origin: http://localhost:3100' "$SEG"  # 403
curl -s -D - -o /dev/null "$SRC" | grep -i access-control-allow-origin   # https://megavid.buzz
```

Internal routes:

```bash
B=http://localhost:3100
for u in discover?kind=trending discover?kind=airing discover?kind=movies 'discover?kind=search&q=bleach' \
  'discover?kind=browse&genre=Action&year=2024' anime/21 'anime/episodes?mal=21' 'anime/latest?per_page=2' \
  'characters?page=1' characters/40 schedule 'manga/search?q=chainsaw&readable=1' \
  manga/chapter/77fc6e02-a381-411d-ace6-4c00deacadb4 proxy/quotes ; do
  printf '%-52s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 40 "$B/api/$u")"
done
curl -s "$B/api/anime/source?mal=1535&ep=1&audio=sub" | jq -c '{status,provider,type,source}'
```

## Appendix B — explicitly unverified

| Claim | Why |
| --- | --- |
| megavid `status: "countdown"` / `iframeUrl` | needs an unaired episode; every fixture returned `ok` or `missing`. Handling exists in `mega.ts` `[code]` |
| A playable `megaplay.buzz` stream | four sampled embed ids returned `200` with an error HTML body and no `.m3u8`; anikoto timestamps were stale |
| Jikan rate limits and true latency | host unreachable all session (`000` after 20 s, DNS fine) |
| anikoto 60 req / 120 s limit | would require deliberately exhausting the limit |
| aniwatch's hard UA requirement | browser UA *and* empty UA both returned `200` during testing |
| aniwatch mirror playback (`type: "mp4"`, `provider: "aniwatch"`) | the code path exists `[code]`, but no episode was found that megavid lacked while aniwatch still served, so the signed Google Video URL was never observed |
| `animex` provider playback (`zuna`/`yuki`/`sora`/`nero`) | their only host, `s-90.megavid.se`, is NXDOMAIN |
| `/api/proxy/media` on a `206` playlist | no upstream returned 206 for a playlist; only segments did |
| aniwatch mirror quality/tracks | the fallback returns `tracks: []` and a single quality by design; no episode was found to exercise it |
| Full production duration of `proxy/media` | `vercel.json` caps it at 30 s while the handler declares 60 s; only local behaviour observed |
| Whether `hasAvailableChapters=true` excludes *every* licensed title | verified it `200`s and filters, but not sampled across 49 000+ titles |
