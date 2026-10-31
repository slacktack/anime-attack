# Client API contract — for UI work

**Give this file to the UI agent.** It is the contract for the app's *own* HTTP API (`app/api/**`).

Rule number one: **the UI only talks to `/api/*` on its own origin.** It never calls AniList, MangaDex,
aniwatch or megavid directly. Referer gates, dead hosts, expired tokens, 400s from upstream and rate limits
are all absorbed server-side. If a screen needs data that no route provides, the fix is a new route, not a
client-side fetch.

| Doc | Who it is for | When to read it |
| --- | --- | --- |
| `docs/API-CLIENT.md` (this file) | UI / client work | always — every endpoint, param, shape, error |
| `docs/STREAMING-APIS.md` | backend / mobile-port work | only when changing resolution, proxying or upstream research |
| `lib/client/api.ts` | UI | the typed helpers; already wraps most routes below |

Every shape here was captured from a running build on **2026-10-31** (commit `101941d`). Two routes are *not*
yet wrapped in `lib/client/api.ts`: `/api/anime/source` and every `/api/manga/*` route — see §4 and §5.

---

## 1. Route map

| Route | Method | Purpose | `Cache-Control` |
| --- | --- | --- | --- |
| `/api/anime/discover` | GET | trending / airing / movies / search / browse | `s-maxage=300, swr=900` |
| `/api/anime/[id]` | GET | one aggregated detail payload | `s-maxage=600, swr=1800` |
| `/api/anime/episodes` | GET | episode list for a MAL id | `s-maxage=900, swr=3600` |
| `/api/anime/latest` | GET | aniwatch episode feed + title search | `s-maxage=120, swr=600` |
| `/api/anime/source` | GET | resolve a playable stream | **`no-store`** |
| `/api/characters` | GET | character browse/search | `s-maxage=600, swr=1800` |
| `/api/characters/[id]` | GET | one character | `s-maxage=600, swr=1800` |
| `/api/schedule` | GET | upcoming airings | `s-maxage=600, swr=1800` |
| `/api/manga/search` | GET | manga browse/search | `s-maxage=300, swr=900` |
| `/api/manga/[id]` | GET | manga detail + chapter list | `s-maxage=300, swr=900` |
| `/api/manga/chapter/[id]` | GET | reader pages + prev/next | `no-store` |
| `/api/manga/image` | GET | image bytes (already-proxied URLs) | `max-age=86400, s-maxage=31536000` |
| `/api/proxy/media` | GET, HEAD | HLS playlist rewrite / byte passthrough | varies |
| `/api/ai` | POST | spoiler-ceiling AI text | none |
| `/api/proxy/quotes` | GET | random quote (+ static fallback) | `max-age=3600` |

Every JSON route except `/api/anime/source` and `/api/manga/chapter/*` is safely cacheable; TanStack Query with
a 5–10 min `staleTime` is comfortable.

---

## 2. Discovery — `GET /api/anime/discover`

`kind` selects the mode. Returns `{ items, kind, ...echo }`.

| `kind` | Extra params | Response keys |
| --- | --- | --- |
| `trending` | — | `items`, `kind` |
| `airing` | — | `items`, `kind` |
| `movies` | — | `items`, `kind` |
| `search` | `q` (required) | `items`, `kind`, `q`, `page` |
| `browse` | `genre`, `year`, `format`, `status`, `sort` (all optional) | `items`, `kind` |

`items[]` is `AnimeSummary`:

```json
{ "id": 20, "title": "Naruto",
  "cover": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20-…jpg",
  "banner": null, "type": "TV", "score": 7.9, "year": 2002 }
```

`score` is a 0–10 float (`null` when unrated). `type` is one of `TV|MOVIE|OVA|ONA|SPECIAL|MUSIC` or `null`.
`cover` is `""` — never `null` — when AniList has no artwork, so render a placeholder on empty string.
`banner` *is* nullable. `browse` has no pagination over HTTP: it always returns the first 30.

---

## 3. Detail — `GET /api/anime/[id]`

`id` is the **AniList** id (not MAL). Returns a single object, not a list:

```json
{ "anime": { "id": 21, "title": "ONE PIECE", "cover": "…", "banner": "…", "type": "TV", "score": 8.7,
             "year": 1999, "bannerImage": "…", "description": "…", "genres": ["Action"],
             "status": "RELEASING", "episodes": null, "studios": ["Toei Animation"],
             "seasonYear": 1999, "nextAiringEpisode": { "episode": 1181, "airingAt": 1793500000 } },
  "malId": 21,
  "accentColor": "#e49335",
  "relations": [ { "id": 466, "title": "One Piece: Defeat the Pirate Ganzack!", "cover": "…", "banner": "…",
                   "type": "OVA", "score": 6.5, "year": 1998, "relationType": "SIDE_STORY",
                   "episodes": 1, "status": "FINISHED" } ],
  "characters": [ { "id": 40, "name": "Luffy Monkey", "image": "…", "role": "MAIN",
                    "voiceActor": "Mayumi Tanaka" } ],
  "recommendations": [ /* AnimeSummary[] */ ] }
```

* **`malId` is the key field for playback.** It is `null` when AniList has no MAL mapping (for example One
  Punch Man S3 has no AniList entry at all). Build watch links only when `malId` is a number.
* `accentColor` is AniList's cover colour (`#rrggbb`) or `null` — use it for the detail-page tint.
* `episodes` may be `null` for long-running shows; do not treat that as an error.
* `airingAt` is Unix **seconds**.
* `description` still contains AniList markup: `__bold__`, `~!spoiler!~`, `[text](url)`, `<br>`. Sanitise.

---

## 4. Episodes — `GET /api/anime/episodes?mal={malId}`

```json
{ "malId": 1535, "anilistId": 1535, "title": "Death Note", "format": "TV",
  "totalEpisodes": 37, "year": 2006, "isMovie": false,
  "episodes": [ { "number": 1, "title": null, "filler": false } ],
  "source": "generated" }
```

`source` tells you how much to trust the list:

| `source` | Meaning | UI treatment |
| --- | --- | --- |
| `"jikan"` | real MAL episode data | show titles and filler badges |
| `"generated"` | Jikan unreachable, list synthesised from `totalEpisodes` | show numbers only; **hide** filler badges (there is no data) |
| `"anilist"` | derived from AniList only | same as generated |

`title` is frequently `null` — always fall back to `Episode {n}`. Jikan being down is the normal state right
now, so expect `"generated"` most of the time; `totalEpisodes: null` plus `"generated"` means **no list at
all** (One Piece), and the aniwatch feed (`/api/anime/latest?q=`) is the only route to episodes.

---

## 5. aniwatch feed — `GET /api/anime/latest`

| Params | Response |
| --- | --- |
| `page` (1-based, default 1), `per_page` (default 12, max 100) | `{ items, q, page }` |
| `q` (title search) | `{ items, q, page }` |

```json
{ "items": [ { "id": 35890, "date": "2026-10-31T02:16:00",
               "slug": "magic-repo-man-dumped-by-my-party-…-episode-5-english-subbed",
               "title": "Magic Repo Man: … Episode 5 English Subbed",
               "link": "https://aniwatchtv.by/magic-repo-man-…/",
               "categoryIds": [123], "tags": [] } ],
  "q": null, "page": 1 }
```

`slug` is the only thing you need to start playback. `title` is raw post markup and needs cleaning —
this repo's helper strips `[brackets]`, `- Episode N`, `(English Subbed)` etc. There is no episode-number
field; parse `/-episode-(\d+)/i` from `slug` (fallback `/episode\s*(\d+)/i` on `title`), and audio from
`/dub(bed)?/i` on `slug + title`.

---

## 6. Playback — `GET /api/anime/source`

The one route with a real state machine. **Never cache it** (`no-store`); TanStack `staleTime: 60_000` on the
client is the intended cache.

Params: `slug` **and/or** `mal` + `ep`, plus `audio=sub|dub`, optional `provider`, optional `refresh=1`.

* Prefer `?mal=&ep=`. It is one upstream call.
* `?slug=` alone still works (server scrapes the episode page, then falls back to slug → title → AniList → MAL),
  but costs 2–3 upstream calls and can fail on very fresh posts.
* `refresh=1` busts the server cache — wire it to a "Retry" button.

Response `200`:

```json
{ "status": "ok",
  "source": "https://cp.megavid.buzz/hls/1e810e75-…/playlist.m3u8",
  "type": "hls",
  "tracks": [ { "file": "https://megavid.buzz/sub/…/eng-2.vtt", "label": "English",
                "kind": "captions", "default": true } ],
  "providers": [], "provider": "loli",
  "malId": 1535, "episode": 1, "audio": "sub" }
```

**`status` drives the whole UI. Handle all five:**

| `status` | Extra fields | What to render |
| --- | --- | --- |
| `"ok"` | `source`, `type`, `tracks` | the player |
| `"missing"` | `message` | "not available at the source" + Retry; if `audio === "dub"` offer "Watch in sub" |
| `"countdown"` | `countdownUrl`, `message` | "hasn't aired yet" — do **not** treat as an error |
| `"error"` | `message` | generic failure + Retry (`refresh=1`) |
| *(HTTP 404)* | `{status:"error", message}` | "couldn't identify this episode — open it from the anime page" |

**Two playback source types, both possible:**

| `type` | Where from | How to play |
| --- | --- | --- |
| `"hls"` | megavid (multi-quality, multi-language subs) | `<VideoPlayer kind="hls">` → hls.js |
| `"mp4"` | aniwatch mirror, `provider: "aniwatch"` — the availability fallback for titles megavid lacks (e.g. One Punch Man S3) | `<VideoPlayer kind="mp4">` → plain `<video src>`. **Single 360p quality, no subtitles, and the URL is signed/expiring**, so always re-resolve rather than persisting it |

`providers[]` is **cosmetic**: in practice only `provider: "loli"` yields a playable source, and the array is
usually empty. A "server picker" UI is optional — do not build logic that depends on it.

**Always proxy media through `/api/proxy/media`:**

```
src    = /api/proxy/media?url=<source>&ref=https://megavid.buzz/&mode=smart
track  = /api/proxy/media?url=<track.file>&ref=https://megavid.buzz/&mode=smart
```

Never feed `source` or `track.file` to the player directly — the origins gate on `Origin`/`Referer` and some
serve MPEG-TS under a bogus `Content-Type`. Escalation already implemented in `WatchView`: on a fatal player
error flip `mode=full`, then move to the next provider, then hard-error. Keep that behaviour.

`/api/proxy/media` details if you need them: `mode=smart` (default) proxies playlists and gates; `mode=full`
proxies every byte. Playlists come back rewritten with absolute proxied URLs, so hls.js never sees an upstream
host. `Range` is honoured when upstream honours it — do not assume `206`.

---

## 7. Characters — `GET /api/characters` and `/api/characters/[id]`

`GET /api/characters?page=1&q=` → `{ items, page }`, page is **1-based**:

```json
{ "items": [ { "id": 127691, "name": "Satoru Gojou", "image": "https://…png", "favourites": 41075 } ],
  "page": 1 }
```

`GET /api/characters/40` → `{ character: { … } }` (wrapped, unlike the list):

```json
{ "character": { "id": 40, "name": "Luffy Monkey", "native": "モンキー・D・ルフィ", "image": "…",
                 "favourites": 32000, "description": "…", "gender": "Male", "age": "17-19",
                 "media": [ /* AnimeSummary[] */ ] } }
```

`image` is nullable on both. `description` carries AniList markup — sanitise.

---

## 8. Schedule — `GET /api/schedule`

No params. Future airings only, earliest first, max 40.

```json
{ "items": [ { "id": 410607, "title": "Little Shark's Day Out Season 2", "cover": "https://…png",
               "episode": 30, "airingAt": 1793484000 } ] }
```

`airingAt` is Unix **seconds** — multiply by 1000 before `new Date()`. `cover` is `""` (never `null`) when
missing. No pagination is exposed.

---

## 9. Manga

Ids are MangaDex UUIDs. Invalid ids are rejected before any upstream call: `400 {"error":"Invalid manga id"}`
(resp. `"Invalid chapter id"`).

**`GET /api/manga/search`** — `q`, `page` (**0-based**, `offset = page * 24`), `order=popular|latest`,
`readable=1`:

```json
{ "items": [ { "id": "c46455c3-…", "title": "Saitama Chainsaw Shoujo", "description": "…",
               "cover": "…", "status": "completed", "year": 2008,
               "tags": ["Action", "Comedy"], "contentRating": "safe", "latestChapter": "4" } ],
  "page": 0, "limit": 24, "total": 46470 }
```

The **response has no top-level `ok`/`error`**; failures are `502 {"error": "…"}`.

**`GET /api/manga/[id]`** — adds `authors`, `artists`, `altTitles`, `chapters`:

```json
{ "id": "…", "title": "The Ghostly Doctor", "description": "…", "cover": "…", "status": "ongoing",
  "year": null, "tags": [], "contentRating": "safe", "latestChapter": "661",
  "authors": ["…"], "artists": ["…"], "altTitles": ["…"],
  "chapters": [ { "id": "0e33faa8-…", "chapter": "450", "volume": null, "title": null,
                  "pages": 5, "group": "…", "publishAt": "…", "externalUrl": null } ] }
```

**The licensed-title rule — implement this exactly:**

| Chapter | Test | Render |
| --- | --- | --- |
| Hosted | `pages > 0 && !externalUrl` | link to `/read/[chapterId]` |
| Official only | `!!externalUrl` | link **out** to `externalUrl` (new tab), label "official" |

Titles can be 100% official-only (Solo Leveling). In that case show "English pages live on the official site"
and the outbound link — never a dead reader link. A manga with `chapters: []` means no English scanlation.

**`GET /api/manga/chapter/[id]`** — the reader payload, `no-store`:

```json
{ "chapterId": "…", "mangaId": "…", "mangaTitle": "The Ghostly Doctor",
  "chapter": "450", "volume": null, "title": null,
  "pages": ["/api/manga/image?url=https%3A%2F%2Fcmdxd98sb0x3yprd.mangadex.network%2Fdata%2F…"],
  "saverPages": ["/api/manga/image?url=https%3A%2F%2F…%2Fdata-saver%2F…"],
  "prev": { "id": "…", "chapter": "449" }, "next": null }
```

`pages` are **already proxied same-origin URLs** — use them as `<img src>` directly, no further work.
`saverPages` are the smaller "Lite" variant (different files, not a resize of the same URL). `prev`/`next`
are `null` at the ends and only ever point at hostable chapters. **`pages: []` is a valid `200`** (that is what
an official-only chapter returns) — render "not readable here", not a network error.

---

## 10. Images

`cover` fields in manga payloads are already `/api/manga/image?url=…` — use as-is. Anime covers/banners are
raw `s4.anilist.co` URLs and are fine to load directly (they are public and CORS-friendly).

---

## 11. AI — `POST /api/ai`

`GET` → `405`. Body (zod-validated; anything else → `400 {"error":"invalid body"}`):

```json
{ "task": "summary|catchup|chat|character|charfacts|charquiz|recommend",
  "animeTitle": "One Piece",
  "ceiling": 1180,
  "question": "…",        // chat only, max 1000 chars
  "characterName": "…",   // character/charfacts/charquiz
  "context": "…" }        // optional, max 5000 chars
```

`ceiling` is the spoiler ceiling — the highest episode the user has seen. It is **required**; pass
`0` if unknown. Success → `{ "text": "…" }` (plain text, possibly with markdown-ish formatting).

The route is **same-origin only**: it returns `403 {"error":"forbidden"}` when the `Origin`/`Referer` host
differs from the request host. Fine from the app, but it will block any cross-origin or APK-style call — that
is deliberate. `500 {"error":"ai failed"}` means the Gemini key is missing or the call failed; degrade
gracefully rather than blocking the screen.

---

## 12. Error shapes — two conventions, both live

| Shape | Used by | Handling |
| --- | --- | --- |
| `{ "error": "message" }` | all `/api/manga/*`, `/api/ai`, `/api/proxy/*`, `/api/anime/[id]`, `/api/characters*` | `throw new Error(json.error)` and show it |
| `{ "status": "error", "message": "…" }` | **only** `/api/anime/source` | read `status` first; `message` is user-facing English |

Status codes in use: `400` invalid params/id, `404` episode could not be identified, `403` AI cross-origin,
`405` wrong method, `500` server/AI failure, `502` upstream failure. Follow this exactly:

```ts
const res = await fetch(url, { headers: { Accept: "application/json" } });
const json = await res.json();
if (!res.ok) throw new Error(json?.error ?? json?.message ?? `Request failed (${res.status})`);
```

`lib/client/api.ts` already implements this as `getJson<T>()` — reuse it for any new route.

---

## 13. Do / Don't

**Do**

* Route every fetch through `lib/client/api.ts` (or extend it) so caching and error shapes stay uniform.
* Build watch links as `/watch/{slug}?mal={malId}&ep={n}&audio=sub` — `slug` for discovery, `mal`+`ep` for speed.
* Expect `null` in `title`, `episodes`, `score`, `year`, `banner`, `malId`, `accentColor`, `prev`, `next`.
* Use `filler` only when `source === "jikan"`.
* Debounce search inputs (~200 ms) — every keystroke otherwise costs an AniList call against a 30 req/min budget.

**Don't**

* Don't call upstream hosts from the browser (AniList, MangaDex, aniwatch, megavid, `s4.anilist.co` covers are
  the only direct fetch, and even those only as `<img>`).
* Don't cache `/api/anime/source` or `/api/manga/chapter/*` — both are `no-store` server-side by design and
  their URLs expire.
* Don't persist `source` URLs (localStorage, share links) — they are signed and short-lived. Persist
  `malId`/`episode` and re-resolve.
* Don't hand `source`/`track.file` straight to the player; always rewrite through `/api/proxy/media`.
* Don't render `description` as raw HTML without sanitising — AniList markup includes `<br>` and links.
* Don't rely on `providers[]` being populated; it usually is empty.

---

## 14. Environment note

Verify against a **development server started from current source**. During this work:

* port `3100` was a *production* build (`npm run start`) — it does not pick up source edits;
* port `3000` went stale and returned `500` on every route including `/`;
* a fresh `next dev` (e.g. `NEXT_DIST_DIR=.next-dev npx next dev -p 3210`) behaved correctly.

If every route suddenly 500s, check which server you are hitting before assuming an API regression.
`npm run verify:apis` runs the endpoint smoke suite.
