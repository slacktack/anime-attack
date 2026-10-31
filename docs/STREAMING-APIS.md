# Streaming, Metadata and Manga APIs — Verified Reference

Audience: a developer building a **mobile APK client** for Anime Attack (repo package `anime-companion`).
Everything here is extracted from the shipped code in this repository plus live HTTP probes made on
**2026-10-31 (UTC)**. Claims that rest on code alone and could not be re-confirmed on the wire are marked
**unverified**.

Repository revision used: `ed64868` — "feat: premium glass revamp, season switcher, streaming + manga pipelines".

Evidence tags: `[code]` = traceable to a file here · `[live]` = observed with curl on 2026-10-31 ·
`[unverified]` = neither.

---

## 1. Overview and architecture

The browser never talks to a stream CDN directly for anything CORS- or referer-gated; it talks to route
handlers that act as a thin, cache-aware proxy layer.

```
 ┌──────────── client (browser today, APK later) ────────────┐
 │ /watch/[slug] → WatchView (client component)              │
 │   ├─ GET /api/anime/source?slug&mal&ep&audio&provider     │
 │   ├─ <VideoPlayer> + hls.js  src=/api/proxy/media?url&ref&mode
 │   └─ <track src=…>           /api/proxy/media?url=…&mode=smart
 └───────────────────────────┬───────────────────────────────┘
                             │ same-origin (JSON / m3u8 / vtt / ts)
 ┌───────────────────────────▼───────────────────────────────┐
 │ Next route handlers (Node runtime)                        │
 │  /api/anime/source        → lib/anime/mega.ts             │
 │  /api/proxy/media         → playlist rewrite / passthrough │
 │  /api/proxy/aniwatch      → WP REST passthrough (browser)  │
 │  /api/manga/*             → search, detail, chapter, image │
 └───┬───────────────────┬───────────────────┬───────────────┘
     ▼                   ▼                   ▼
 ┌─────────────┐ ┌──────────────────┐ ┌──────────────────────────────────┐
 │ Metadata    │ │ Resolution       │ │ Media (fetched with Referer + UA) │
 │ anilist     │ │ aniwatchtv.by    │ │ cp.megavid.buzz   HLS playlists   │
 │ jikan       │ │  /<slug>/ iframe │ │ cdn.megavid.buzz  MPEG-TS segments│
 │ kitsu       │ │ megavid.buzz     │ │ megavid.buzz/vid  obfuscated segs │
 │ wp-json     │ │  /mal/{m}/{e}/   │ │ megavid.buzz/sub  subtitles .vtt  │
 │ mangadex    │ │  {sub|dub}/source│ │ s-90.megavid.se   NXDOMAIN, dead  │
 └─────────────┘ └──────────────────┘ │ *.mangadex.network, uploads…      │
                                      └──────────────────────────────────┘
```

Two rules explain almost every design decision:

1. **Anything origin-gated must be proxied.** `megavid.buzz` returns `403` to a browser from another origin,
   and some assets ship `Access-Control-Allow-Origin: https://megavid.buzz` `[live]`.
2. **Everything else stays direct** so the proxy (a cold serverless function) is not in the hot path for
   multi-megabyte segments — at commit `ed64868`, `smart` mode leaves segment URIs absolute `[code]`. A later
   working-tree change inverts this default (see the snapshot warning in 4.2).

---

## 2. Data-layer APIs

### 2.1 AniList GraphQL — primary metadata

| Item | Value |
| --- | --- |
| Endpoint | `https://graphql.anilist.co`, **POST only** (`GET` → `404`) `[live]` |
| Headers | `Content-Type: application/json`, `Accept: application/json` `[code]` `lib/anime/anilist.ts` |
| Body | `{ query, variables }` |
| Cache | `next: { revalidate: 300 }` (5 min) |
| Errors | `!res.ok` → `throw AniList ${status}`; any `json.errors` key → `throw "AniList query error"` |
| Rate limit | `x-ratelimit-limit: 30`, `x-ratelimit-remaining: 26` `[live]` — the **degraded 30/min tier**, not the documented 90/min |
| Status | reachable, correct payloads `[live]` |

Queries in use `[code]` `lib/anime/queries.ts` — shared field set:

```graphql
# MEDIA_FIELDS
id title { english romaji native } coverImage { large medium }
bannerImage format averageScore seasonYear episodes status genres
nextAiringEpisode { episode airingAt } studios(isMain: true) { nodes { name } }

Page(perPage: 20) { media(sort: TRENDING_DESC, type: ANIME) { … } }
Page(perPage: 20) { media(status: RELEASING, sort: POPULARITY_DESC, type: ANIME) { … } }
Page(perPage: 20) { media(format: MOVIE, sort: POPULARITY_DESC, type: ANIME) { … } }
query ($q: String, $page: Int) { Page(page: $page, perPage: 20) { media(search: $q, type: ANIME, sort: SEARCH_MATCH) { … } } }
query ($id: Int) { Media(id: $id, type: ANIME) { … description(asHtml: false) } }
query ($id: Int) { Media(id: $id, type: ANIME) { characters(sort: ROLE, perPage: 25) {
  edges { role node { id name { full native } image { large } } voiceActors(language: JAPANESE) { name { full } } } } } }
query ($id: Int) { Media(id: $id, type: ANIME) { recommendations(sort: RATING_DESC, perPage: 20) {
  nodes { mediaRecommendation { … } } } } }
query ($id: Int) { Media(id: $id, type: ANIME) { relations { edges { relationType node { … } } } } }
```

Also `[code]` `lib/anime/anilist-extra.ts`: `Page.characters(sort: FAVOURITES_DESC, search:)` perPage 30;
`Character(id:)` with `description(asHtml:false)`, `gender`, `age`, `favourites`,
`media(sort: POPULARITY_DESC, perPage: 12)`; `Page.airingSchedules(notYetAired: true, sort: TIME)` perPage 40;
`browseAnime` with `$genre/$year/$season/$format/$status/$sort` (perPage 30, **no page variable** — first page
only); `GenreCollection`; and the two-field extras query
`query ($id: Int) { Media(id: $id) { idMal coverImage { color } } }`.

**`idMal` is the most important field in the application** — the only bridge to anything streamable, because
megavid is keyed purely on MAL ids (section 3).

```json
// success [live]
{"data":{"Media":{"id":813,"idMal":813,"title":{"english":"Dragon Ball Z","romaji":"Dragon Ball Z"},
"episodes":291,"status":"FINISHED"}}}

// unmapped id [live] — HTTP 200, not an HTTP error
{"errors":[{"message":"Not Found.","status":404,"locations":[{"line":1,"column":2}]}],"data":{"Media":null}}
```

The second shape is the trap: HTTP 200 with an `errors` array and `Media: null`. `anilistFetch` throws on the
`errors` key, so the app treats it as fatal `[code]` `[live]`.

Normalisation `[code]` `lib/anime/anilist-map.ts`: title = `english → romaji → native → "Untitled"`; score =
`Math.round(averageScore) / 10`; cover = `coverImage.large || .medium || ""`; `type` whitelisted against
`TV|MOVIE|OVA|ONA|SPECIAL|MUSIC` else `null`; `studios` = `studios(isMain:true).nodes[].name`.

*Repo bug worth fixing in a port:* `AnimeSchema` in `lib/anime/types.ts` omits `seasonYear` and
`nextAiringEpisode`, yet `anilist-map.ts` passes both to `AnimeSchema.parse(...)`. Zod strips unknown keys, so
both are silently dropped and downstream code reads them elsewhere `[code]`.

### 2.2 Jikan REST — MAL episode lists (unreliable)

| Item | Value |
| --- | --- |
| Endpoint | `GET https://api.jikan.moe/v4/anime/{malId}/episodes` `[code]` `lib/anime/jikan.ts` |
| Headers | `Accept: application/json` |
| Cache | `next: { revalidate: 3600 }` |
| Failure contract | any non-`ok` response **or** thrown error → `[]`; never throws to the caller |
| Mapping | `data[].mal_id → number` (fallback `index+1`), `data[].title → title`, `data[].filler → filler` |
| Status | **`000`** — DNS resolves (`135.181.39.91`) but TCP connect never completes; three 15 s attempts all timed out `[live]` |

Because Jikan is best-effort, the episode grid degrades to a **generated** list `[code]`
`components/screens/EpisodeList.tsx`:

```ts
if (data?.length) return data;
if (!totalEpisodes || totalEpisodes < 1) return [];
const count = Math.min(totalEpisodes, 2000);
return Array.from({ length: count }, (_, i) => ({ number: i + 1, title: count === 1 ? "Movie" : null, filler: false }));
```

The generated list is only as good as AniList's `episodes`, which is `null` for long-running shows (One Piece
returns `episodes: null` `[live]`) — in that case the grid is empty and only the Aniwatch feed (2.4) helps.
The `2000` cap is a deliberate guard. Jikan's documented ~3 req/s and 60/min quotas could not be measured
because the host was unreachable `[unverified]`.

### 2.3 Kitsu — secondary discovery

`GET https://kitsu.io/api/edge/anime?filter[text]={q}&page[limit]=20` and `?sort=-userCount&page[limit]=20`,
`Accept: application/vnd.api+json`, `revalidate: 3600`, returns `[]` on any failure `[code]`
`lib/anime/kitsu.ts`. **Use `kitsu.io`, not `kitsu.app`:** `kitsu.io/api/edge/anime` → `200`, `kitsu.app` →
`403` behind Cloudflare `[live]`. Fields come from JSON:API `attributes` (`titles.en || canonicalTitle`,
`posterImage.original|large`, `coverImage.original`, `subtype`, `averageRating/10`, `startDate.slice(0,4)`).

### 2.4 Aniwatch WordPress REST — real episode feed and slugs

| Item | Value |
| --- | --- |
| Base | `https://aniwatchtv.by/wp-json/wp/v2` `[code]` `lib/anime/aniwatch-types.ts` (`BASE_URL`) |
| Server headers | `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`, `Referer: https://aniwatchtv.by` |
| Browser path | rewritten to `/api/proxy/aniwatch?url=…&ref=…`, because a browser cannot set `User-Agent` `[code]` |
| Cache | `revalidate: 300` server-side; proxy route returns `s-maxage=3600` |
| Status | `200` `[live]` |

| Purpose | Request |
| --- | --- |
| Latest episodes | `/posts?page={p}&per_page={n}&orderby=date&order=desc` |
| Single episode | `/posts/{postId}` |
| Series list | `/categories?page={p}&per_page=100&orderby=count&order=desc` |
| Episodes of a series | `/posts?categories={categoryId}&per_page=100&orderby=date&order=desc` |
| Episode search | `/posts?search={q}&per_page={n}` |
| Series by name | `/categories?search={q}&per_page=10` |

Only `id`, `date`, `slug`, `link`, `title.rendered`, `categories[]`, `tags[]` are kept (zod `WpPostRawSchema`);
`content.rendered`, `excerpt` and `yoast_head` are discarded. Those blobs are large — fetch and drop, never
store. Observed `[live]`:

```json
[{"id":48,"count":1218,"description":"","link":"https://aniwatchtv.by/case-closed/","name":"Case Closed",
  "slug":"case-closed","taxonomy":"category","parent":0,"meta":[],"yoast_head":"<!-- … -->"}]
```

Posts headers `[live]`: `x-wp-total: 25114`, `cf-cache-status: DYNAMIC`, no rate-limit header. The documented
UA+Referer requirement is the code's defensive choice `[code]`; during this check `/posts?per_page=1` also
returned `200` with curl's default UA and no Referer `[live]` — treat the headers as *recommended*, keep
sending them (Cloudflare bot rules are the risk).

The REST payload has no episode field, so the number is parsed from slug then title, and audio from either
`[code]`: `/-episode-(\d+)/i`, `/episode\s*(\d+)/i`, `/dub(bed)?/i`.

---

## 3. Streaming resolution pipeline

### 3.1 Flow

```
1. client  GET /api/anime/source?slug=&mal=&ep=&audio=sub|dub&provider=&refresh=1   [code] source/route.ts
            └─ if mal && ep are supplied the slug is IGNORED          ← the reliable path
2. server  resolveTargetFromSlug(slug)                                     [code] lib/anime/mega.ts
            GET https://aniwatchtv.by/<slug>/  (UA + Referer)
            regex <iframe[^>]*src="([^"]+)"  → playerUrl
            regex megavid\.buzz/mal/(\d+)/(\d+)/(sub|dub) in the page
            if absent → GET playerUrl, retry the same regex / a nested iframe
3. server  for id of PROVIDER_ORDER:
            GET https://megavid.buzz/mal/{mal}/{ep}/{audio}/source?axsv={id}
            UA + Referer: https://megavid.buzz/ + Accept: application/json
            AbortSignal 12 s, cache: no-store, redirect: follow
4. server  gate: GET <source> with Range: bytes=0-512 — accept only if body starts "#EXTM3U"
5. server  track filter: DNS-resolve the host of each of the first 12 tracks (1.5 s timeout)
6. server  200 {status, source, tracks, providers, provider, malId, episode, audio, …}, Cache-Control: no-store
7. client  src = /api/proxy/media?url=<source>&ref=https://megavid.buzz/&mode=smart
```

`slug → megavid` is the fragile half. Live check on a current post `[live]`: the iframe on
`/magic-repo-man-…-episode-5-english-subbed/` is
`https://aniwatchtv.by/wp-content/themes/animestream-child/player/?source=blogger&url=TDQ0…%3D%3D`, and that
player page yields a Google Video MP4, not megavid:

```js
var fileUrl = "https://rr4---sn-vgqsknd7.googlevideo.com/videoplayback?expire=…&itag=18&source=blogger…";
var sources = [{"file":"https://rr4---sn-vgqsknd7.googlevideo.com/videoplayback?…","label":"360p"}];
```

So the megavid regex cannot match and `resolveTargetFromSlug` throws "No player found on the episode page".
This is why the UI always builds watch links with `?mal=&ep=` from `EpisodeList`, and why `mega.ts` itself says
"Open it from the anime page instead" `[code]`. A port should treat **`mal` + `ep` as required**. Unknown slugs
are worse than errors: `/dragon-ball-z-episode-1/` → `301 → https://aniwatchtv.by` (homepage, `200`, no iframe)
`[live]`.

### 3.2 The megavid source contract

```
GET https://megavid.buzz/mal/{malId}/{episode}/{sub|dub}/source?axsv={provider}
```

Success, DBZ MAL 813 ep 1, `axsv=loli` `[live]` (trimmed, real values):

```json
{
  "status": "ok",
  "source": "https://cp.megavid.buzz/hls/7c14bd1c-a907-4491-9bbc-c42d49db1af0/playlist.m3u8",
  "tracks": [
    {"file":"https://megavid.buzz/sub/in9td8y9…/D5ZwsD-…/eng-5.vtt",
     "label":"English","kind":"captions","default":true},
    {"file":"https://megavid.buzz/sub/E9oSZrp…/D5ZwsD-…/thumbnails.vtt",
     "label":"","kind":"captions","default":false}
  ],
  "mega": true, "animex": false, "providers": [], "chapters": [], "type": "hls"
}
```

Failure, MAL 40866 (One Punch Man S3) `[live]`:

```json
{"status":"missing","code":404,
 "message":"We couldn't find this episode. It may not exist, isn't available yet, or has been removed.",
 "retryable":false}
```

| Upstream field | Use in `mega.ts` `[code]` |
| --- | --- |
| `status` | cast to `"ok" \| "missing" \| "countdown" \| "error"` |
| `source` | passthrough URL; must pass the `#EXTM3U` gate when `status === "ok"` |
| `type` | `"mp4"` kept; anything else **including absent** → `"hls"` |
| `tracks[]` | DNS-filtered, otherwise forwarded as-is |
| `providers[]` | forwarded as `{id, tip, hard}` for the server picker |
| `iframeUrl` | read only when `status === "countdown"`, forwarded as `countdownUrl` `[no live example]` |
| `message` | forwarded verbatim |
| `chapters[]` | **dropped** (intro/outro offsets unused) |
| `mega`, `animex`, `code`, `retryable` | **dropped** |

Two defects to fix in a port `[code]` `[live]`: upstream sends `"srclang":"en"` lowercase while `MegaTrack`
declares `srcLang?`, so the value is always `undefined`; and `mega.ts` casts the JSON instead of validating
it with zod (unlike `aniwatch.ts`), so only `Array.isArray` protects the client.

### 3.3 Provider order and what actually resolves

`PROVIDER_ORDER = ["loli", "zuna", "yuki", "nero"]` `[code]`. An explicit `?provider=` is tried first, then
the rest. Rules: a throwing/non-2xx provider is skipped; `ok` with a `source` that fails the `#EXTM3U` gate
is **skipped** (this is what demotes dead CDNs); `missing` **aborts the loop when `audio === "sub"`** because
a missing sub means the episode does not exist; the last non-ok result is returned from a 15 s cache.

Measured 2026-10-31 `[live]`:

| `axsv` | Response | Source host | Resolves? |
| --- | --- | --- | --- |
| `loli` | `ok`, `type: "hls"` | `cp.megavid.buzz`, or `megavid.buzz/vid/…` for CR/single-file titles | **yes** |
| `zuna` / `yuki` / `nero` | `ok`, `type: "hls"` | `s-90.megavid.se` | **no** |
| `sora` | `ok`, `type: "hls"` | `s-90.megavid.se` | **no**, and it is **not in `PROVIDER_ORDER`** |

`s-90.megavid.se` → `Host … not found: 3(NXDOMAIN)` `[live]`. In practice **`loli` is the only working
provider**; the four-way failover degrades to one attempt plus three 12 s timeouts. Upstream advertises
`providers: [zuna, yuki, sora, loli, nero]` (each `{tip, hard:false}`) even when those hosts are dead — so
`providers[]` is a hint, not a health check. `sora` could be added to the order safely but is pointless while
its host stays dead.

Latency matters: megavid answered in ~2.0 s (Death Note dub) and ~5.2 s (OPM S2 dub); two 8 s probes timed out
before succeeding at 20 s. Budget 2–6 s per attempt.

CDN families `[live]`:

| Family | Master | Variants | Segments | Notes |
| --- | --- | --- | --- | --- |
| A `cp.megavid.buzz` | `/hls/{uuid}/playlist.m3u8` | `/hls/{uuid}/{480p,720p}/video.m3u8` | `cdn.megavid.buzz/{uuid}/{q}/video{n}.ts` | `ACAO: *`; `type: "hls"`, `mega: true` |
| B `megavid.buzz/vid/…` | `…/{token}/master.m3u8` (other providers: `master.txt`) | one `RESOLUTION=1920x1080` variant + `#EXT-X-I-FRAME-STREAM-INF` | `…/seg-{n}-f1-v1-a1.{jpg,html,js}` — **obfuscated extensions, real MPEG-TS** | `ACAO: https://megavid.buzz`; **`type` absent**, `mega: false`, `animex: true` |

Family B also returns `chapters`, e.g. `[{"title":"Intro","start":0,"end":110},{"title":"Outro","start":1355,"end":1453}]`
(observed for DBZ ep 1 on `axsv=zuna`) `[live]` — free skip-intro data currently discarded.

### 3.4 Resolver caching and timeouts

| Thing | Value |
| --- | --- |
| `SOURCE_TTL` (ok) | 90 000 ms |
| countdown TTL | 30 000 ms |
| negative TTL (missing/error) | 15 000 ms |
| `TARGET_TTL` (slug → target) | 600 000 ms |
| per-request timeout | 12 000 ms |
| track-host DNS timeout | 1 500 ms |
| cache key | `` `${malId}:${episode}:${audio}:${provider ?? "auto"}` `` |
| HTTP cache | `Cache-Control: no-store, max-age=0` |
| client cache | TanStack Query `staleTime: 60_000`, `retry: 1`, `retryDelay: 600` `[code]` `WatchView.tsx` |

Both caches are in-process `Map`s: per-instance, lost on cold start, a latency optimisation only.

---

## 4. HLS handling in the media proxy

`app/api/proxy/media/route.ts` GET parameters: `url` (required, absolute http/https, else `400`), `ref`
(`Referer` sent upstream, defaults to `{protocol}//{host}/` of `url`), `mode` (`smart` default / `full`).
Upstream request: full Chrome UA (`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like
Gecko) Chrome/131.0 Safari/537.36`), `Referer: ref`, `Accept: */*`, client `Range` if present, `no-store`,
25 s timeout, redirects followed.

### 4.1 Playlist detection

```ts
const looksPlaylist =
  /mpegurl/i.test(upstreamType) || /\.m3u8/i.test(targetUrl.pathname) ||
  /[?&][tv]\.m3u8/i.test(targetUrl.search) || /\.m3u8/i.test(upstream.url);
// else: sniff the first 48 bytes for "#EXTM3U" before streaming the body
```

The sniff is essential: some providers serve the master as **`master.txt`** and subtitles as **`asset.txt`**
`[live]`. Because the sniff precedes the subtitle branch, `master.txt` is treated as a playlist and
`asset.txt` as subtitles — correctly `[code]`.

### 4.2 Rewrite rules

```ts
const isMaster = /#EXT-X-STREAM-INF/i.test(text) || /#EXT-X-MEDIA:/i.test(text);
// every URI="…" attribute inside any #EXT-X-* tag is rewritten in BOTH modes
//   (covers #EXT-X-MEDIA, #EXT-X-I-FRAME-STREAM-INF)
// plain URI lines: master → always proxied; media → proxied when mode === "full"
//                                         or (working-tree change, see note) unless host allows direct
```

> **Snapshot warning.** At commit `ed64868` the media-playlist branch ends with `return absolute`, i.e.
> `smart` leaves segment URLs **direct**. During the writing of this document the working tree gained an
> in-progress change that inverts that default: `return hostAllowsDirect(absolute) ? absolute : proxied(…)`
> with `const DIRECT_SEGMENT_HOSTS = ["echovideo.to"]`. Under that version segments are **proxied by default**
> and only named hosts stay direct. Both behaviours are recorded here because the direction of this default is
> the single biggest performance and reliability decision in the proxy — re-read the file before relying on
> either. The measurements in 4.3 (and every other section) were taken against the committed behaviour.

Real output replaying the shipped function over a live family-A master, `mode=smart`,
`ref=https://megavid.buzz/` `[code]` `[live]`:

```http
#EXT-X-STREAM-INF:BANDWIDTH=1987912,AVERAGE-BANDWIDTH=925703,CODECS="avc1.64001f,mp4a.40.2",RESOLUTION=854x480,CLOSED-CAPTIONS=NONE
https://app.example/api/proxy/media?url=https%3A%2F%2Fcp.megavid.buzz%2Fhls%2F7c14bd1c-…%2F480p%2Fvideo.m3u8&ref=https%3A%2F%2Fmegavid.buzz%2F&mode=smart
#EXT-X-STREAM-INF:BANDWIDTH=3091635,AVERAGE-BANDWIDTH=1469033,CODECS="avc1.640020,mp4a.40.2",RESOLUTION=1280x720,CLOSED-CAPTIONS=NONE
https://app.example/api/proxy/media?url=https%3A%2F%2Fcp.megavid.buzz%2Fhls%2F7c14bd1c-…%2F720p%2Fvideo.m3u8&ref=https%3A%2F%2Fmegavid.buzz%2F&mode=smart
```

The media playlist those lead to keeps segments direct in `smart` mode (`#EXTINF:4.000000,` then
`https://cdn.megavid.buzz/7c14bd1c-…/480p/video0.ts`); with `mode=full` that line becomes
`…/api/proxy/media?url=https%3A%2F%2Fcdn.megavid.buzz%2F…%2Fvideo0.ts&ref=…&mode=full`.

### 4.3 Why playlists must be proxied — the measurements

All rows measured 2026-10-31 `[live]`:

| Request | Result |
| --- | --- |
| `megavid.buzz/vid/…/master.m3u8` | `200`, `Content-Type: application/vnd.apple.mpegurl`, **`ACAO: https://megavid.buzz`** |
| `megavid.buzz/vid/…/seg-1-f1-v1-a1.jpg`, no Referer | **`403`** |
| same, `Referer: https://megavid.buzz/` | `200`, `video/mp2t`, body starts `47 40` (`G@`, MPEG-TS sync) |
| same, `Referer: https://example.com/` | `403` |
| `megavid.buzz/sub/…/eng-5.vtt`, `Referer: https://megavid.buzz/` | `200`, `text/vtt`, `ACAO: https://megavid.buzz` |
| same subtitle, no Referer | **`403`** |
| `cp.megavid.buzz/hls/{uuid}/playlist.m3u8` | `200`, `ACAO: *`, clean content type |
| `cdn.megavid.buzz/…/480p/video0.ts` | `200`, **`Content-Type: text/vnd.trolltech.linguist;charset=utf-8`**, body is MPEG-TS, `ACAO: *` |

Therefore: playlists (both families) must be proxied; `megavid.buzz/sub/…` subtitles must be proxied
(referer-gated); family-B segments must be proxied (referer-gated *and* CORS-pinned) hence `mode=full`;
family-A segments can stay direct (`ACAO: *`), hence `mode=smart` suffices **under the committed rewrite rule**.
Under the in-progress proxy-by-default rule described in 4.2, family-A segments are proxied too unless the host
is in `DIRECT_SEGMENT_HOSTS` — correct but slower and more bandwidth through the function.

The bogus `text/vnd.trolltech.linguist` type on family-A segments is real. hls.js does not care (it appends
bytes), but a native player that picks a demuxer from `Content-Type` will fail. The proxy passes the type
through unchanged `[code]` — a known sharp edge for the APK.

### 4.4 Smart vs full, and automatic escalation

`WatchView` starts in `smart` and flips to `full` on the first fatal player error, then cycles the remaining
`providers[]`, then hard-errors `[code]`:

```ts
const handleFatal = useCallback(() => {
  if (!fullProxy) { setFullProxy(true); return; }
  const available = (data?.providers ?? []).map((p) => p.id);
  const currentIndex = data?.provider ? available.indexOf(data.provider) : -1;
  const next = available.slice(currentIndex + 1).find((id) => id !== data?.provider);
  if (next) { setProvider(next); setFullProxy(false); return; }
  setHardError(true);
}, [fullProxy, data]);
```

`VideoPlayer` gives escalation a chance to fire: on fatal `NETWORK_ERROR` it calls `hls.startLoad()` up to
twice (800/1600 ms backoff); on fatal `MEDIA_ERROR` it calls `hls.recoverMediaError()` up to twice; then
`onFatal` `[code]`. This is exactly right for family B: smart mode hands the browser segment URLs it cannot
fetch, hls.js exhausts retries, `onFatal` flips `mode=full`, playback resumes.

### 4.5 Range, status and returned headers

Client `Range` is forwarded; status is `206` when upstream is `206`, else `200`. `Content-Range` and
`Accept-Ranges` are forwarded; `Content-Length` only when upstream is not content-encoded. Upstream Range
support is inconsistent `[live]`: `Range: bytes=0-99` gave `206` with `content-range: bytes 0-99/186872`,
`Range: bytes=0-1023` on the same asset gave `200` with no `Content-Range`; family-B segments ignored `Range`
entirely. **Never require `206` for seeking.** Always returned: `Access-Control-Allow-Origin: *`,
`Access-Control-Allow-Headers: Range, Content-Type`,
`Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges`. `HEAD` is implemented with a
10 s timeout and `Referer: https://megavid.buzz/`.

### 4.6 SRT → VTT

Content-driven, only for URLs whose path ends `.vtt|.srt|.ass|.ssa|.txt` `[code]`:

```ts
let out = text.replace(/^\uFEFF/, "").trimStart();
if (out.startsWith("WEBVTT")) return out;                      // pass through
out = out.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");    // 00:00:01,000 → 00:00:01.000
return `WEBVTT\n\n${out}`;
```

Response: `text/vtt; charset=utf-8`, `max-age=3600, s-maxage=3600`. The comma→dot swap is the only SRT
repair; `.ass`/`.ssa` get a `WEBVTT` header bolted on and will not render properly. Every live subtitle
observed was already real `text/vtt`, so this branch is defensive and **unverified** against live traffic.

### 4.7 Cache TTLs

| Response | `Cache-Control` |
| --- | --- |
| Playlists | `public, s-maxage=4, stale-while-revalidate=10` |
| Subtitles | `public, max-age=3600, s-maxage=3600` |
| Binary (segments, MP4) | `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400` |
| `HEAD` | `public, max-age=3600` |
| Errors | none (JSON `{error}` + CORS) |

The 4 s playlist TTL is deliberate: playlists are rewritten per request and embed `ref`/`mode`, which change
with failover state. Note `vercel.json` caps this route at `maxDuration: 30` while the file declares `60` —
the platform wins in production, so long segment feeds can be truncated there but not locally `[code]`.

---

## 5. Subtitle tracks

Tracks arrive as `{file, label, kind, default}` and sometimes `srclang`. `kind` is always `"captions"` in
every sample, even for subtitles; the app ignores it and forces `kind="subtitles"` on the `<track>` `[code]`.

```json
[{"file":"https://megavid.buzz/sub/…/eng-2.vtt","label":"English","kind":"captions","default":true},
 {"file":"https://megavid.buzz/sub/…/nob-9.vtt","label":"Norwegian (Bokmål)","kind":"captions","default":false},
 {"file":"https://megavid.buzz/sub/…/thumbnails.vtt","label":"","kind":"captions","default":false}]
```

```json
{"file":"https://cp.megavid.buzz/hls/f82b8e26-…/captions/en.vtt","label":"English","kind":"captions","srclang":"en"}
```

| Scheme | File pattern | Language encoding | Host |
| --- | --- | --- | --- |
| Per-language assets | `{eng,ara,fre,ger,spa,por,ita,rus,tur,pol,swe,dan,dut,nob,fin,heb,ind,tha,chi,bul}-{n}.vtt` | ISO 639-2 code in filename, English name in `label` | `megavid.buzz/sub/…` |
| CR/named single file | `captions/en.vtt`, `track_0_CR_English_eng.vtt` | two-letter code in path, `srclang` present | `cp.megavid.buzz/hls/{uuid}/captions/` |

`default: true` is not a reliable selection signal: the player renders every track with `default={false}` and
drives selection via `video.textTracks[i].mode` `[code]`. An empty `label` marks **thumbnail-sprite tracks**
(`thumbnails.vtt`), which appear in the picker as `Track 2` because of `track.label || "Track N"` `[code]`. A
port should filter `/thumbnails/i.test(file) || label === ""`.

Filtering actually implemented `[code]`:

```ts
const checks = await Promise.all(
  tracks.slice(0, 12).map(async (track) =>                    // ← only the first 12 considered
    (await resolveHost(new URL(track.file).hostname)) ? track : null),  // 1.5 s DNS timeout
);
return checks.filter((t): t is MegaTrack => t !== null);
```

Consequences, all verified `[code]` `[live]`: host DNS is the **only** filter; tracks on `s-90.megavid.se` are
dropped while `megavid.buzz` / `cp.megavid.buzz` survive; and the 12-track cap silently truncates — One Punch
Man S1 ep 1 advertises 19 tracks (18 languages + thumbnails) and only Arabic→Norwegian Bokmål reach the
client, so Polish onwards is lost. DBZ ep 1 has 2 tracks, so its `thumbnails.vtt` survives the cap and shows
up in the UI. The cap does bound DNS lookups at 12 per request.

The dead `s-90.megavid.se` (NXDOMAIN `[live]`) was the CDN behind `zuna`, `yuki`, `nero` and `sora`. It makes
three of four providers unplayable (the `#EXTM3U` gate rejects their `source`), empties their track lists via
the DNS filter even though they report `status: "ok"`, and can leave a stale 90 s cached `ok` entry pointing
at a dead host — which is what the smart→full→next-provider escalation exists to recover from. If the host
returns, nothing needs changing except adding `sora` to the order.

---

## 6. Manga (MangaDex)

Base `https://api.mangadex.org`; covers `https://uploads.mangadex.org` `[code]` `lib/manga/mangadex.ts`. Every
server call sends a descriptive UA as MangaDex's policy requires:

```
User-Agent: AnimeAttack/1.0 (https://github.com/slacktack/anime-attack)
Accept: application/json
```

`GET /manga?limit=1` → `200`, `cache-control: max-age=15, public, s-maxage=2592000, stale-while-revalidate=15`;
no `x-ratelimit` header exposed `[live]`.

| Purpose | Request | Revalidate |
| --- | --- | --- |
| Search / browse | `/manga?limit=24&offset={page*24}&contentRating[]=safe&contentRating[]=suggestive&includes[]=cover_art[&title={q}&order[relevance]=desc \| &order[latestUploadedChapter]=desc \| &order[followedCount]=desc]` | 300 s |
| Detail | `/manga/{id}?includes[]=cover_art&includes[]=author&includes[]=artist` | 300 s |
| Chapter feed | `/manga/{id}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0` | 300 s |
| Chapter meta | `/chapter/{id}?includes[]=manga` | 600 s |
| Manga for reader | `/manga/{mangaId}?includes[]=cover_art` | 3600 s |
| Page manifest | `/at-home/server/{chapterId}` | **`no-store`** |
| Reader nav feed | `/manga/{mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=asc` | 600 s |

Pages are `{baseUrl}/data/{hash}/{file}` (HD) and `{baseUrl}/data-saver/{hash}/{file}` (Lite) `[code]`.
Observed manifest `[live]`:

```json
{"result":"ok","baseUrl":"https://cmdxd98sb0x3yprd.mangadex.network",
 "chapter":{"hash":"a890522a02d8da8b59d9ca40ddc4f32c",
   "data":["1-8d9bdd8d…f013f5.png","2-f7e78ab4…0231c.png"],
   "dataSaver":["1-cae9447…25250.jpg","2-8b4dbfe1…2966.jpg"]}}
```

`baseUrl` is a rotating node host — never cache it. `data` and `dataSaver` use **different extensions and
different content hashes** for the same page; do not derive one from the other.

### 6.1 Gotchas, verified

**a. `includeEmptyPages=0` / `includeExternalUrl=0` are traps.** Measured on *Na Honjaman Level-Up*
(Solo Leveling, `32d76d19-8a05-4db0-9fc2-e0b0648fe9d0`) `[live]`:

| Feed request | Chapters |
| --- | --- |
| default (as the app sends it) | 24 — all `pages: 0` with `externalUrl: https://www.webnovel.com/…` |
| `&includeExternalUrl=0` | **0** |
| `&includeEmptyPages=0` | **0** |

Filtering at the API level leaves nothing to show and no explanation, so the app requests the full feed and
classifies client-side `[code]`: hosted = `pages > 0 && !externalUrl`, official = `!!externalUrl`.

**b. `/at-home/server/{id}` succeeds for external-only chapters** — `200` with an empty manifest, not an
error `[live]`:

```json
{"result":"ok","baseUrl":"https://cmdxd98sb0x3yprd.mangadex.network","chapter":{"hash":"","data":[],"dataSaver":[]}}
```

A reader must treat `pages.length === 0` as "not readable here", not as a network failure — this repo shows
"No pages available", and the nav list filters `pages > 0` `[code]`.

**c. `hasAvailableChapters` is only a query filter.** `&hasAvailableChapters=true` is accepted and shrinks the
result set substantially — `total` fell from 86 128 (default safe+suggestive browse) to 46 470 when the flag
was added `[live]` (the two requests differed only in that flag and in `includes[]=cover_art`) — but the
attribute was **absent** from every manga object, even with the filter applied `[live]`. It therefore cannot be
used as a per-item readability flag.

**d. Duplicate chapter numbers.** Multiple scanlation groups release the same number; the app collapses on
`chapter.chapter ?? chapter.id` preferring the hosted copy `[code]`:
`const hosted = chapter.pages > 0 && !chapter.externalUrl; if (!existing || (hosted && !existingHosted)) seen.set(key, chapter);`

**e. Numeric sort needs `NaN` handling.** Chapter numbers are strings; the app uses `parseFloat` and pushes
`NaN` last in both directions. Skipping this misplaces extras and `.5` chapters `[code]`.

**f. Language filter is English-only** (`translatedLanguage[]=en`) — titles without an English scanlation show
an empty chapter list even though the manga exists.

### 6.2 Image proxy — `app/api/manga/image/route.ts`

| Item | Value |
| --- | --- |
| Query | `?url=<absolute url>`; http/https only else `400` |
| Host allowlist | `uploads.mangadex.org`, `mangadex.org`, `mangadex.network` **and their subdomains** (`=== host \|\| endsWith("." + host)`) — anything else `400 {"error":"Host not allowed"}` |
| Upstream headers | same UA, `Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8`, `Referer: https://mangadex.org/` |
| Validation | `res.ok`, `content-type` starts with `image/`, `content-length` non-zero |
| Timeout | 15 000 ms |
| Fallback | if host ends in `mangadex.network`, retry the **same path** on `https://uploads.mangadex.org` |
| Response | mirrored `Content-Type`, `Cache-Control: public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800`, `ACAO: *`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` |
| Failure | `502 {"error":"Image unavailable"}`, `Cache-Control: no-store` |

Fallback verified in both directions `[live]`:

```
GET https://cmdxd98sb0x3yprd.mangadex.network/data/a890522a…/1-8d9bdd8d….png → 200 image/png 3 785 040 bytes
GET https://uploads.mangadex.org/data/a890522a…/1-8d9bdd8d….png              → 200 image/png 3 785 040 bytes
```

The at-home node host is not `uploads.mangadex.org`, so the allowlist must include `*.mangadex.network`; an
`uploads`-only allowlist breaks the reader entirely.

---

## 7. Endpoint status matrix

All statuses measured **2026-10-31 (UTC)**. `000` = no HTTP response (connect/TLS failure), not a status code.

| Endpoint / host | Status | Notes | Reliable? |
| --- | --- | --- | --- |
| `POST https://graphql.anilist.co` | `200` | GraphQL only (`GET` → `404`); `x-ratelimit-limit: 30` | **Yes** |
| `https://api.jikan.moe/v4/anime/{id}/episodes` | **`000`** | DNS ok, TCP connect never completes; 3×15 s | **No** — keep optional |
| `https://kitsu.io/api/edge/anime` | `200` | JSON:API, needs `Accept: application/vnd.api+json` | Yes |
| `https://kitsu.app` | **`403`** | Cloudflare; not the API host | No |
| `https://aniwatchtv.by` | `200` | WordPress 7.0 + AnimeStream child theme | Yes |
| `GET /wp-json/wp/v2/posts` | `200` | `x-wp-total: 25114`; UA/Referer recommended | Yes |
| `GET /wp-json/wp/v2/categories` | `200` | payload carries large `yoast_head` blobs | Yes |
| `GET /{episode-slug}/` | `200` / `301` | `301 → homepage` for unknown slugs | Fragile |
| `megavid.buzz/mal/{mal}/{ep}/sub/source?axsv=loli` | `200` | `{status, source, tracks, providers, type}`; 2–6 s | **Yes** |
| same, `axsv=zuna\|yuki\|nero\|sora` | `200` | returns a dead-host source | **No** |
| `s-90.megavid.se` | **NXDOMAIN** | dead CDN behind 3 of 4 providers | **Dead** |
| `cp.megavid.buzz/hls/{uuid}/playlist.m3u8` | `200` | `ACAO: *`, clean content type | Yes |
| `cdn.megavid.buzz/…/video{n}.ts` | `200`/`206` | TS body but `text/vnd.trolltech.linguist` | Yes (wrong type) |
| `megavid.buzz/vid/…/master.m3u8` | `200` | `ACAO: https://megavid.buzz` — must proxy | Yes |
| `megavid.buzz/vid/…/seg-*.jpg` | `403` bare / `200` with Referer | body is MPEG-TS | Only via proxy |
| `megavid.buzz/sub/…/eng-*.vtt` | `403` bare / `200` with Referer | hotlink-gated | Only via proxy |
| `GET https://api.mangadex.org/manga` | `200` | 86 128 titles (safe+suggestive) | Yes |
| `GET /at-home/server/{id}` | `200` | empty manifest for external-only chapters | Yes |
| `https://uploads.mangadex.org` | `200` | covers + page data; fallback for node hosts | Yes |
| `api.consumet.org/anime/gogoanime/top-airing` | **`301`** | `→ github.com/consumet/api.consumet.org` README; retired | **Dead** |
| `api.anify.tv/search/anime/…` | **`301`** | `→ https://api.anify.tv/` (self-redirect loop) | **Dead** |
| `api.allanime.day/api` | **`403`** | WAF block | **Dead** |
| `https://allanime.day` | `301` | `→ https://allanime.day//` | No |
| `https://animepahe.ru` | `301` | `→ https://animepahe.su/` | Moved |
| `https://animepahe.com` | `301` | `→ https://animepahe.pw/` | Moved |
| `https://anitaku.pe` | `200` | plain Apache, no Cloudflare | Yes, for scraping |
| `https://animesuge.cz` | `200` | the source captured in `some-apis.txt` | Yes |
| `https://animechan.io/api/v1/random` | **`404`** | quotes route always serves its static fallback | Degraded |

The brief listed AllAnime `403` and AnimePahe `403`; measured values are AllAnime `403`
(`api.allanime.day/api`) and AnimePahe **`301`** to `animepahe.su`/`animepahe.pw`. Both are unusable without
re-scraping, but the codes differ.

`some-apis.txt` at the repo root is a HAR-style capture of `animesuge.cz` AJAX calls (`x-requested-with:
XMLHttpRequest`, `credentials: include`, matching `referrer`). It documents a fourth possible source this app
does not use; responses wrap JSON in an HTML string (`result.html`), so it needs an HTML parser and is not a
drop-in replacement `[code]`.

---

## 8. Known-broken and degraded cases

| Case | Symptom | Cause | Handling |
| --- | --- | --- | --- |
| One Punch Man S3, MAL `40866` | `{"status":"missing","code":404,"retryable":false}` | megavid has no such episode | "Episode not found at the source" + Retry `[code]` `[live]` |
| OPM S3 in AniList | `errors: [Not Found]`, `Media: null` | no AniList entry maps to MAL 40866 (`Media(idMal:40866)` → 404) | `anilistFetch` throws; no `idMal`, so watch links carry no `?mal=` `[code]` `[live]` |
| Unknown episode slug | `301 → homepage`, then "No player found on the episode page" | site redirects unknown slugs | 502 JSON with that message `[code]` `[live]` |
| Current-week episodes | slug resolution fails outright | iframe is the `player/?source=blogger` indirection → `googlevideo.com` MP4, not megavid | only `?mal=&ep=` works; UI always supplies them `[code]` `[live]` |
| Jikan down | no episode titles, no filler flags | host unreachable (`000`) | generated `1..min(episodes,2000)` list `[code]` `[live]` |
| Long-running shows | empty grid when Jikan is down | AniList `episodes: null` (One Piece, Conan) | Aniwatch category feed only `[code]` `[live]` |
| Licensed manga (Solo Leveling) | chapter list full, reader empty | all English entries are `pages: 0` + `externalUrl`; at-home returns `200` with empty `data[]` | "English pages live on the official site" + "Read officially" link `[code]` `[live]` |
| No English scanlation | empty chapter list | hard-coded `translatedLanguage[]=en` | none — out of scope `[code]` |
| `zuna`/`yuki`/`nero`/`sora` | `ok` but unplayable | `s-90.megavid.se` NXDOMAIN | `#EXTM3U` gate + DNS track filter → silent skip `[code]` `[live]` |
| Dub missing for sub-only title | `missing` while `audio=dub` | upstream has no dub | "Dub isn't out for this one yet" + SUB button `[code]` |
| Subtitle 403 | tracks listed but never render | `Referer`/`Origin` hotlink gate on `megavid.buzz/sub/…` | `WatchView` always proxies track URLs `[code]` `[live]` |
| `thumbnails.vtt` in menu | blank-label "Track 2" that does nothing | label `""`, `kind: "captions"` | unfiltered; the 12-track cap sometimes hides it `[code]` `[live]` |
| `countdown` status | code supports `{status:"countdown", iframeUrl}` → `countdownUrl` | — | **no live example**; future episodes returned `missing`/404 instead `[live]` |
| AnimeChan quotes | always the static 10-quote fallback | upstream `404` | by design `[code]` `[live]` |
| `maxDuration` mismatch | media proxy capped at 30 s in production, 60 s locally | two values committed | `[code]` |

---

## 9. Failover and resilience playbook

```
resolveStream(malId, episode, audio):
  1. cache hit (90 s positive / 15 s negative)                  → reuse
  2. explicit provider? try it first, then PROVIDER_ORDER minus it
  3. for id of [loli, zuna, yuki, nero]:        # add "sora" only if its host returns
       GET /mal/{id}/{ep}/{audio}/source?axsv={id}     timeout 12 s
       !raw                                            → next provider
       status == "countdown"                           → return + countdownUrl (30 s cache)
       status == "missing" && audio == "sub"           → STOP (episode does not exist)
       status == "ok" and source passes #EXTM3U gate   → accept (90 s cache)
       otherwise                                       → remember as `last`, next provider
  4. return `last` (15 s cache) | throw "Every stream provider is unavailable right now."

playback:
  src = proxy(source, ref=https://megavid.buzz/, mode=smart)
  fatal → mode=full (same provider) → next provider (mode=smart) → hard error + Retry (refresh=1)
```

* **Always send `?mal=&ep=`.** The slug path costs an extra round trip, fails on current-week posts and can
  silently land on the homepage.
* **Expect 2–6 s** per resolve, up to 4 × 12 s if `loli` is down. Show a real loading state.
* **Never cache `source` or `baseUrl` longer than 90 s** — both embed per-session tokens.
* **Cache metadata hard**: AniList 5 min, MangaDex 5–60 min, aniwatch 5 min. Those are the rate-limited surfaces.
* **Treat "usable body", not "200", as success** — Jikan `000`, at-home `200` with empty pages, megavid `ok`
  with a dead host and AniList `200` with `errors` all defeat naive status-code checks.
* Negative caching is short by design (15 s) so a blip does not pin an episode to "missing".
* Timeout budget: 12 s megavid/aniwatch, 25 s media proxy, 15 s manga image, 10 s `HEAD`, 4 s quotes.

---

## 10. Reuse notes for a mobile APK client

### 10.1 What must stay server-side

| Call | Why not client-side |
| --- | --- |
| `aniwatchtv.by/wp-json/…` | needs a browser `User-Agent` + `Referer`, forbidden in a browser context |
| `aniwatchtv.by/<slug>/` | same, and it is ~200 KB of markup |
| `megavid.buzz/mal/…/source` | needs `Referer: https://megavid.buzz/`; the response is the whole stream inventory — keep it behind your auth/rate limiting |
| `megavid.buzz/vid/…` playlists and segments | CORS pinned + referer-gated (`403` otherwise) `[live]` |
| `megavid.buzz/sub/…` subtitles | referer-gated `[live]` |
| `api.mangadex.org` | works client-side, but expects a descriptive UA and polite rates; a shared proxy UA is better |
| `uploads.mangadex.org` + node hosts | node hostname rotates; the `uploads` fallback matters `[live]` |

A native client can fetch family-A segments (`cdn.megavid.buzz`, `ACAO: *`) and cover images itself to save
proxy bandwidth.

### 10.2 Minimum server surface

```
GET /source?mal&ep&audio=sub|dub&provider?     → MegaSource JSON (shape in 3.2)
GET /media?url&ref&mode=smart|full              → playlist rewrite + passthrough + SRT→VTT + Range
GET /manga/search?q&page&order=popular|latest   → {items, page, limit, total}
GET /manga/{id}                                 → MangaDetail
GET /manga/chapter/{id}                         → MangaReaderData (pages, saverPages, prev, next)
GET /manga/image?url                            → host-allowlisted image bytes
```

Keep these envelopes identical to the ones documented here so both clients share one backend.

### 10.3 Headers, CORS and gating

* Upstream UA: the full Chrome string is what the code sends; a bare
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` sufficed for aniwatch `[live]`.
* Upstream `Referer`: **never omit it for `megavid.buzz`** — `403` without it `[live]`.
* Default `ref` to the target's own origin when the client omits it; `WatchView` hard-codes
  `https://megavid.buzz/` for playlists, segments and subtitles, which works for every host observed.
* Return `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Range, Content-Type`,
  `Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges`; without the expose header a
  browser player cannot read `Content-Range`.
* The media proxy is an **open proxy by design** here (`url` is any http(s) URL). For a public APK, allowlist
  at least `cp.megavid.buzz`, `cdn.megavid.buzz`, `megavid.buzz`, `*.megavid.se`, `*.mangadex.network`,
  `uploads.mangadex.org`, or it will be abused.

### 10.4 Native player notes

* Media3/ExoPlayer: expect `master.m3u8`, `master.txt`, and single-variant masters.
* **Do not trust `Content-Type`** — family-A segments are MPEG-TS bytes served as
  `text/vnd.trolltech.linguist;charset=utf-8` `[live]`. Force the TS extractor or correct the type in your proxy.
* Family-B segment extensions are `.jpg`/`.html`/`.js` while the bytes are MPEG-TS `[live]`; never infer the
  container from the extension.
* Some masters use `#EXT-X-I-FRAME-STREAM-INF` with `URI="…"` — rewrite `URI="…"` attributes as well as plain
  lines, or scrubbing thumbnails will hit the origin and fail.
* Range support is inconsistent; do not require `206` for seeking. TS VOD seeks fine from a plain `200`.
* Subtitles are side-loaded `text/vtt`: build `MediaItem.SubtitleConfiguration` with `MimeTypes.TEXT_VTT` and
  load through your proxy. Filter `thumbnails.vtt`.
* Retry policy that mirrors this app: 2 network retries with backoff, 2 media-error recoveries, then escalate
  proxy mode, then escalate provider.

### 10.5 Rate limits and caching

| Upstream | Budget | Strategy |
| --- | --- | --- |
| AniList | 30 req/min observed `[live]` (90 documented) | 5–10 min cache; batch with GraphQL aliases (this repo fires 8–10 separate queries per detail page — wasteful) |
| Jikan | unreachable; ~3 req/s, 60/min documented `[unverified]` | never block UI on it |
| MangaDex | ~5 req/s for `/at-home`, ~10 req/s general, documented `[unverified]` | 300–3600 s server cache; `/at-home` `no-store` but cached per chapter client-side |
| aniwatch WP | no headers exposed `[live]` | 5 min cache; `per_page=100` max |
| megavid | no headers exposed | 90 s positive / 15 s negative; ≤1 in-flight resolve per `(mal, ep, audio)` |

### 10.6 Re-verify before shipping

1. Which `axsv` providers resolve (today only `loli`) and whether `s-90.megavid.se` returns.
2. That megavid still keys on **MAL** ids, and whether `status` can still be `countdown`.
3. That `aniwatchtv.by` still redirects unknown slugs (with `Referer`, and with a mobile UA).
4. That the `megavid.buzz/vid/…` family still obfuscates extensions and gates by referer.
5. That token paths survive a full 26-minute episode (mid-session expiry test).
6. MangaDex `/at-home` node rotation, and that `uploads.mangadex.org` still mirrors `/data/`.
7. Your egress IP's AniList rate-limit tier.
8. **The current `smart`-mode default** (direct-vs-proxied segments, `DIRECT_SEGMENT_HOSTS`) and whether any
   newly listed host such as `echovideo.to` actually serves `ACAO: *` — treat such host lists as claims to test.
9. Android network-security-config: every host observed is `https`, so no cleartext exception is needed — but
   pinning to Cloudflare-fronted hosts will break when upstreams rotate.

---

## 11. Legal and ethical caveats

1. **The stream path is unlicensed third-party content.** `megavid.buzz` and `aniwatchtv.by` are not rights
   holders; this app hosts, stores and redistributes nothing — it resolves a URL a third-party site exposes.
   Publishing an APK that does this in a jurisdiction where it is not permitted carries risk for the
   publisher, not merely the user. Take advice before distribution; "we only link" is not a defence everywhere.
2. **No content is redistributed by this codebase.** The media proxy is a pass-through with a referer header
   and a playlist rewrite; it writes no bytes to disk and no layer archives segments (CDN `s-maxage` is a hint,
   not storage). Keep it that way — a client that downloads and re-shares episodes changes the posture entirely.
3. **Licensed manga is not read in-app.** MangaDex removes hosted pages for licensed titles and replaces them
   with an `externalUrl` to the official publisher. The app surfaces those as outbound links with an explicit
   "English pages live on the official site" notice and never fetches the official page's images. Do not add a
   scraper for those URLs. `[code]` `MangaDetailView.tsx` `[live]`
4. **Prefer official sources.** Metadata here comes from public documented APIs (AniList, MAL via Jikan, Kitsu,
   MangaDex); discovery, library, schedule, characters and manga metadata all work without the streaming path,
   which is therefore removable.
5. **No keys or secrets are bundled, and none should be.** The Gemini key lives in `.env.local` and is read
   server-side only; the client has no credentials. Megavid and aniwatch need no key today. The JW Player
   library key `IDzF9Zmk.js` seen on aniwatch's player page is *their* public embed key — do not copy it in.
6. **Respect rate limits and identifiers.** Keep MangaDex's descriptive UA and the existing caches; do not strip
   politeness headers for speed. The `403`/`301` responses in section 7 are refusals — treat them as
   "not available" rather than something to bypass.
7. **No DRM circumvention anywhere.** No key extraction, no widevine handling, no token forgery: the pipeline
   only reads URLs that unauthenticated public pages already expose. Anything needing decryption of a
   protected stream is out of scope and must stay out.
8. **Personal data stays local.** Progress is `localStorage` only (`anime:progress:{malId}:{episode}`), no
   accounts, no server-side user records `[code]` `WatchView.tsx`. Keep the APK local-first; if you add
   analytics, never log stream URLs — they embed session tokens.

---

## 12. Verified title fixtures

Probed 2026-10-31 against AniList (`Media(id:)` / `Media(idMal:)`) and
`megavid.buzz/mal/{mal}/{ep}/sub/source?axsv=loli` (plus `dub` where noted) `[live]`.

| Title | AniList id | MAL id | `episodes` | Episode | Result | Source host | Tracks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dragon Ball Z | `813` | `813` | 291 | 1 sub, 1 dub | `ok` | `cp.megavid.buzz` | 2 (English + thumbnails); dub 1 |
| Dragon Ball Super | `21175` | `30694` | 131 | 1 | `ok` | `cp.megavid.buzz` | 4 |
| Death Note | `1535` | `1535` | 37 | 1 sub, 1 dub | `ok` | `cp.megavid.buzz` | 2; dub 1 (`captions/en.vtt`, `srclang: en`) |
| One Piece | `21` | `21` | `null` | 1 | `ok` | `cp.megavid.buzz` | 1 |
| One Piece | `21` | `21` | `null` | **1180** | `ok` | `megavid.buzz/vid/…` (family B) | 2 (`English (CR English)` + thumbnails) |
| One Piece | `21` | `21` | `null` | 1181 | `missing` (404) | — | 0 |
| Naruto | `20` | `20` | 220 | 1 | `ok` | `cp.megavid.buzz` | 1 |
| One Punch Man S1 | `21087` | `30276` | 12 | 1 sub, 1 dub | `ok` | `cp.megavid.buzz` | **19 upstream** (18 langs + thumbnails) → **12 after the cap**; dub 18 |
| One Punch Man S2 | `97668` | `34134` | 12 | 1 sub, 1 dub | `ok` | `megavid.buzz/vid/…` (single 1080p variant) | 8 upstream → 8 (7 langs + thumbnails); dub 8 |
| Your Name. (movie) | `21519` | `32281` | 1 | 1 sub, 1 dub | `ok` | `cp.megavid.buzz` | 1; dub 1 |
| One Punch Man S3 | **no AniList entry** (`Media(idMal:40866)` → `errors: [Not Found]`) | `40866` | — | 1 sub, 1 dub | **`missing`** (404, `retryable: false`) | — | 0 |

Corrections to the fixture list as supplied — several numbers are MAL ids, not AniList ids:

| Brief said | Reality |
| --- | --- |
| "DBZ 813" | Correct both ways: AniList `813` = MAL `813` |
| "DBS 30694" | `30694` is the **MAL** id; AniList id for Dragon Ball Super is `21175`. (AniList id `30694` is *Makai Senki Disgaea 2*, MAL `694`.) |
| "Death Note 1535" | Correct both ways |
| "One Piece 21 (ep 1180 works)" | Correct; 1180 playable, 1181 not yet available |
| "Naruto 20" | Correct both ways |
| "OPM S1 30276" | `30276` is the **MAL** id; AniList id is `21087` |
| "OPM S2 34134" | `34134` is the **MAL** id; AniList id is `97668` |
| "Your Name 32281 (AniList 21519)" | Correct pair: AniList `21519` ↔ MAL `32281` |
| "OPM S3 MAL 40866 (missing)" | Correct: megavid returns `missing`/404 and AniList has no entry for MAL `40866` |

---

## Appendix A — re-running the checks

```bash
# AniList must be POSTed; GET returns 404
curl -s -D - -X POST https://graphql.anilist.co -H 'Content-Type: application/json' \
  -d '{"query":"{Media(id:813){id idMal episodes}}"}' | grep -i x-ratelimit

# megavid source, one provider at a time (expect 2-6 s)
curl -s --max-time 15 \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' \
  -H 'Referer: https://megavid.buzz/' -H 'Accept: application/json' \
  'https://megavid.buzz/mal/813/1/sub/source?axsv=loli'

# prove the referer gate (family-B segment)
curl -s -o /dev/null -w '%{http_code}\n' 'https://megavid.buzz/vid/<tok>/<tok>/seg-1-f1-v1-a1.jpg'                  # 403
curl -s -o /dev/null -w '%{http_code}\n' -H 'Referer: https://megavid.buzz/' '…/seg-1-f1-v1-a1.jpg'                  # 200

host s-90.megavid.se        # NXDOMAIN

# manga gotchas
UA='User-Agent: AnimeAttack/1.0 (https://github.com/slacktack/anime-attack)'
curl -s -H "$UA" 'https://api.mangadex.org/manga/32d76d19-8a05-4db0-9fc2-e0b0648fe9d0/feed?limit=500&translatedLanguage%5B%5D=en&includeFutureUpdates=0'
curl -s -H "$UA" 'https://api.mangadex.org/at-home/server/f7d2cb75-83b2-426b-bdbd-032870c30abb'   # 200 + empty data[]
```

## Appendix B — explicitly unverified

* `status: "countdown"` / `iframeUrl` handling — no live instance found; future episodes returned `missing`/404.
* SRT/ASS conversion path — every live subtitle observed was already `text/vtt`.
* That a browser `User-Agent` is *required* by aniwatch's WP REST API — plain curl returned `200`.
* `megavid.buzz` behaviour under a mobile `User-Agent` — only a desktop Chrome UA was probed.
* Whether `s-90.megavid.se` returns, and whether `sora` ever resolved elsewhere.
* Real rate limits for aniwatch WP, megavid and MangaDex `/at-home` — no headers exposed.
* Jikan's quotas — the host was unreachable for the whole check window.
* Payloads behind the Consumet / Anify / AllAnime / AnimePahe / Anitaku responses in section 7 (redirects were
  not followed to inspect bodies).
