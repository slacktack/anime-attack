# AniwatchTV.by - Complete API Documentation

> **Base URL:** `https://aniwatchtv.by`
> **Platform:** WordPress 7.0 + AnimeStream Theme v2.3.2 (Child Theme v1.0.2)
> **Date Crawled:** 2026-07-05

---

## Table of Contents

1. [Streaming APIs](#1-streaming-apis)
2. [WordPress REST API](#2-wordpress-rest-api)
3. [Admin AJAX Endpoints](#3-admin-ajax-endpoints)
4. [Video Issue Reporter API](#4-video-issue-reporter-api)
5. [oEmbed API](#5-oembed-api)
6. [RSS Feeds](#6-rss-feeds)
7. [Search & Discovery](#7-search--discovery)
8. [URL Structure Patterns](#8-url-structure-patterns)
9. [Site Configuration](#9-site-configuration)

---

## 1. Streaming APIs

### 1.1 Video Player Endpoint (Primary)

The video player is loaded via an iframe that points to the child theme's player page with an encrypted URL.

**Endpoint:**
```
GET {BASE_URL}/wp-content/themes/animestream-child/player/
```

**Query Parameters:**
| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| `source`  | string | Yes      | Video source provider (e.g., `blogger`) |
| `url`     | string | Yes      | Base64-encoded encrypted video URL    |

**Example Request:**
```javascript
fetch("https://aniwatchtv.by/wp-content/themes/animestream-child/player/?source=blogger&url=TDQ0YVNoQmVKb29tWlBIWTF3SnJUVGhOOVNoSDVDUlhyNFd4SFBnMUk5R1puZVExWjBkREQwQTJMZi92RDVHa3lUeHFSYTNkSUxoVWtoNWFNbjl2S3JMck0zckw4aFk5Y0hPTnY2Wkd4aEc2UGVNTUtKdkpzU1lFUzBXUDZlTEIzMTJRQ3k4dFcybzBhZ1B5QmYxTS93PT0%3D", {
  "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://aniwatchtv.by/"
  }
});
```

**Response:** HTML page with JW Player setup:
```html
<!doctype html>
<html>
<head>
  <title>JW Player</title>
  <script src="https://cdn.jwplayer.com/libraries/IDzF9Zmk.js"></script>
</head>
<body>
  <div id="player"></div>
  <script>
    var fileUrl = "https://rr5---sn-vgqskn67.googlevideo.com/videoplayback?expire=...&itag=18&source=blogger...";
    var sources = [
      {"file":"https://rr5---sn-vgqskn67.googlevideo.com/videoplayback?...","type":"mp4","label":"360p","default":true}
    ];
    var thumbUrl = "https://i9.ytimg.com/vi_blogger/97LzxfIxaY8/1.jpg?...";
    jwplayer('player').setup({
      width: '100%', height: '100%',
      autostart: false, mute: false,
      image: thumbUrl,
      sources: sources
    });
  </script>
</body>
</html>
```

**Key Points:**
- The `url` parameter is **double Base64-encoded** (URL-safe Base64). First decode URL encoding (`%3D` → `=`), then decode Base64 to get an intermediate encrypted string. The server decrypts this internally.
- Video sources are **Google Video URLs** hosted on Blogger's CDN (`*.googlevideo.com`)
- Player uses **JW Player** with a public library key `IDzF9Zmk.js`
- Videos are served as **MP4** with quality labels (typically `360p`, sometimes `720p`)

---

### 1.2 Video URL Decryption (Server-Side Only)

The encrypted `url` parameter uses **server-side decryption**. You cannot generate valid player URLs without the server's private key. The flow is:

```
Episode Page HTML → Extract iframe src → Base64Decode(url param) → Server decrypts → Google Video URL
```

**To get the actual video file URL programmatically:**

1. Fetch the episode page HTML
2. Extract the `iframe src` URL
3. Fetch the player page with that URL
4. Parse the HTML to extract `fileUrl` or `sources` from the inline JS

**Example (Python):**
```python
import re, requests
from bs4 import BeautifulSoup

BASE = "https://aniwatchtv.by"
headers = {"User-Agent": "Mozilla/5.0", "Referer": BASE}

# Step 1: Fetch episode page
resp = requests.get(f"{BASE}/wistoria-wand-and-sword-season-2-episode-12-english-subbed/", headers=headers)

# Step 2: Extract iframe src
soup = BeautifulSoup(resp.text, 'html.parser')
iframe = soup.find('iframe')
player_url = iframe['src']

# Step 3: Fetch player page
player_resp = requests.get(player_url, headers=headers)

# Step 4: Extract video URL from JS
file_url = re.search(r'var fileUrl = "([^"]+)"', player_resp.text).group(1)
sources = re.search(r'var sources = (\[.*?\]);', player_resp.text, re.DOTALL).group(1)
thumb_url = re.search(r'var thumbUrl = "([^"]*)"', player_resp.text)

print(f"Video URL: {file_url}")
print(f"Thumbnail: {thumb_url.group(1) if thumb_url else 'N/A'}")
```

---

### 1.3 Mirror/Server Switching

Some episodes support multiple servers. The mirror selection works client-side via the `loadMi()` function:

```javascript
// From tsfn.js - loads a mirror by base64-decoding the value
function loadMi(selectElement) {
  if (selectElement.value.length < 1) return false;
  if (tsmjsload) {
    // JavaScript loading enabled - inject directly
    document.getElementById("pembed").innerHTML = atob(selectElement.value);
    document.querySelector(".mirror>option").setAttribute("disabled", "disabled");
    return true;
  } else {
    // Fallback - redirect
    window.location.assign(selectElement.value);
    return true;
  }
}
```

When a `<select class="mirror">` option has a Base64-encoded iframe HTML as its `value`, calling `loadMi()` injects it into the player container.

---

### 1.4 Direct Video Download

The player page exposes direct MP4 URLs from Google's CDN. These URLs are **time-signed** and expire after a few hours.

**Download via Python:**
```python
import requests

video_url = "https://rr5---sn-vgqskn67.googlevideo.com/videoplayback?expire=..."
headers = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://aniwatchtv.by/wp-content/themes/animestream-child/player/"
}

response = requests.get(video_url, headers=headers, stream=True)
with open("episode.mp4", "wb") as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)
```

---

## 2. WordPress REST API

**Base:** `https://aniwatchtv.by/wp-json/wp/v2/`

### 2.1 List Episodes (Posts)

```
GET /wp-json/wp/v2/posts
```

**Query Parameters:**
| Parameter   | Type    | Default | Description                           |
|-------------|---------|---------|---------------------------------------|
| `page`      | int     | 1       | Page number                           |
| `per_page`  | int     | 10      | Items per page (max 100)              |
| `search`    | string  | —       | Search keyword                        |
| `categories`| int     | —       | Filter by category ID (anime series)  |
| `orderby`   | string  | date    | Sort field (date, title, id)          |
| `order`     | string  | desc    | Sort direction (asc, desc)            |
| `after`     | string  | —       | ISO8601 date filter                   |
| `_embed`    | bool    | —       | Include embedded resources            |

**Example Request:**
```javascript
// Get latest episodes
fetch("https://aniwatchtv.by/wp-json/wp/v2/posts?per_page=20&page=1&orderby=date&order=desc", {
  headers: { "User-Agent": "Mozilla/5.0" }
});

// Search episodes
fetch("https://aniwatchtv.by/wp-json/wp/v2/posts?search=black+clover&per_page=10", {
  headers: { "User-Agent": "Mozilla/5.0" }
});

// Get episodes by anime (category)
fetch("https://aniwatchtv.by/wp-json/wp/v2/posts?categories=2051&per_page=100", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

**Response:**
```json
[
  {
    "id": 29663,
    "date": "2026-07-05T15:09:00",
    "slug": "iron-wok-jan-episode-1-english-subbed",
    "link": "https://aniwatchtv.by/iron-wok-jan-episode-1-english-subbed/",
    "title": { "rendered": "Iron Wok Jan! Episode 1 English Subbed" },
    "content": { "rendered": "<p>Description HTML...</p>", "protected": false },
    "categories": [2051],
    "tags": [],
    "author": 2,
    "class_list": ["post-29663", "post", "type-post", "category-iron-wok-jan"]
  }
]
```

---

### 2.2 Get Single Episode

```
GET /wp-json/wp/v2/posts/{post_id}
```

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-json/wp/v2/posts/29663?_embed", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

---

### 2.3 List Categories (Anime Series)

```
GET /wp-json/wp/v2/categories
```

**Query Parameters:**
| Parameter  | Type | Default | Description          |
|------------|------|---------|----------------------|
| `per_page` | int  | 10      | Max 100              |
| `page`     | int  | 1       | Page number          |
| `orderby`  | str  | name    | name, count, id      |
| `order`    | str  | asc     | asc, desc            |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-json/wp/v2/categories?per_page=100&orderby=count&order=desc", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

**Sample Response:**
```json
[
  {
    "id": 375,
    "count": 12,
    "name": "'Tis Time for \"Torture,\" Princess Season 2",
    "slug": "tis-time-for-torture-princess-season-2"
  },
  {
    "id": 1620,
    "count": 13,
    "name": "\"Ippon\" again!",
    "slug": "ippon-again"
  }
]
```

> **Note:** `count` = number of episodes. Each category = one anime series.

---

### 2.4 Get Single Category

```
GET /wp-json/wp/v2/categories/{category_id}
```

---

### 2.5 Get Posts by Category (Episodes of a Series)

```javascript
// Get all episodes of a specific anime
fetch("https://aniwatchtv.by/wp-json/wp/v2/posts?categories=2051&per_page=100&orderby=date&order=desc", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

---

### 2.6 List Tags

```
GET /wp-json/wp/v2/tags
```

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-json/wp/v2/tags?per_page=100&orderby=count&order=desc", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

---

### 2.7 Taxonomies

```
GET /wp-json/wp/v2/taxonomies
```

**Available taxonomies:**
- `category` - Episode categories (anime series)
- `post_tag` - Tags (used by posts and anime CPT)
- `series_franchise` - Series/Franchise groupings (for anime CPT)
- `nav_menu` - Navigation menus

---

### 2.8 Series Franchise

```
GET /wp-json/wp/v2/series_franchise
```

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-json/wp/v2/series_franchise?per_page=100", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

---

## 3. Admin AJAX Endpoints

**Base:** `https://aniwatchtv.by/wp-admin/admin-ajax.php`

These endpoints require `POST` requests with `Content-Type: application/x-www-form-urlencoded`.

### 3.1 Update View Count (Normal)

Increments the view counter for an episode.

```
POST /wp-admin/admin-ajax.php
```

**Parameters:**
| Parameter | Type | Required | Description       |
|-----------|------|----------|-------------------|
| `action`  | str  | Yes      | `dynamic_view_ajax` |
| `post_id` | int  | Yes      | Episode post ID   |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-admin/admin-ajax.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: new URLSearchParams({
    action: "dynamic_view_ajax",
    post_id: "29663"
  })
});
```

**Response:**
```json
{ "views": "1,234" }
```

---

### 3.2 Bulk View Update

Sends accumulated view counts from localStorage.

```
POST /wp-admin/admin-ajax.php
```

**Parameters:**
| Parameter | Type  | Required | Description                   |
|-----------|-------|----------|-------------------------------|
| `action`  | str   | Yes      | `dynamic_bulk_view_ajax`      |
| `views`   | JSON  | Yes      | Object mapping post_id → count |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-admin/admin-ajax.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: new URLSearchParams({
    action: "dynamic_bulk_view_ajax",
    views: JSON.stringify({ "29663": 3, "29664": 1 })
  })
});
```

---

### 3.3 Bookmark - Add

```
POST /wp-admin/admin-ajax.php
```

**Parameters:**
| Parameter | Type | Required | Description       |
|-----------|------|----------|-------------------|
| `action`  | str  | Yes      | `bookmark_push`   |
| `id`      | int  | Yes      | Anime post ID     |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-admin/admin-ajax.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: new URLSearchParams({
    action: "bookmark_push",
    id: "28426"
  }),
  credentials: "include"
});
```

**Response:** Typically returns empty or minimal HTML. The bookmark is stored server-side for logged-in users and in localStorage for guests.

---

### 3.4 Bookmark - Remove

```
POST /wp-admin/admin-ajax.php
```

**Parameters:**
| Parameter | Type | Required | Description         |
|-----------|------|----------|---------------------|
| `action`  | str  | Yes      | `bookmark_remove`   |
| `id`      | int  | Yes      | Anime post ID       |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-admin/admin-ajax.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: new URLSearchParams({
    action: "bookmark_remove",
    id: "28426"
  }),
  credentials: "include"
});
```

---

### 3.5 Bookmark - Get Order

Fetches the correct display order for bookmarked items.

```
POST /wp-admin/admin-ajax.php
```

**Parameters:**
| Parameter | Type  | Required | Description              |
|-----------|-------|----------|--------------------------|
| `action`  | str   | Yes      | `bookmark_get_order`     |
| `ids`     | array | Yes      | Array of anime post IDs  |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-admin/admin-ajax.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: new URLSearchParams({
    action: "bookmark_get_order",
    ids: JSON.stringify([28426, 28427, 28428])
  }),
  credentials: "include"
});
```

**Response:**
```json
{
  "data": [28428, 28426, 28427],
  "error_ids": []
}
```

---

### 3.6 Bookmark - Get HTML

Retrieves rendered HTML cards for bookmarked anime.

```
POST /wp-admin/admin-ajax.php
```

**Parameters:**
| Parameter | Type  | Required | Description              |
|-----------|-------|----------|--------------------------|
| `action`  | str   | Yes      | `bookmark_get`           |
| `ids`     | array | Yes      | Array of anime post IDs  |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-admin/admin-ajax.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: new URLSearchParams({
    action: "bookmark_get",
    ids: JSON.stringify([28426, 28427])
  }),
  credentials: "include"
});
```

**Response:**
```json
{
  "data": [
    "<div class=\"bsx\" data-index=\"0\">...anime card HTML...</div>",
    "<div class=\"bsx\" data-index=\"1\">...anime card HTML...</div>
  ],
  "error_ids": []
}
```

---

## 4. Video Issue Reporter API

**Base:** `https://aniwatchtv.by/wp-json/vir/v1/`

**Global Config (found on episode pages):**
```javascript
VIR = {
  "restUrl": "https://aniwatchtv.by/wp-json/vir/v1/",
  "restNonce": null,
  "publicNonce": "5d325f4d04",
  "maxFileMB": "3",
  "isLoggedIn": "",
  "buttonPlacement": "auto",
  "buttonAutoClass": "light",
  "buttonAutoPosition": "below"
};
```

### 4.1 Report Video Issue

```
POST /wp-json/vir/v1/report
```

**Headers:**
| Header        | Value                      |
|---------------|----------------------------|
| `X-WP-Nonce`  | `{restNonce}` (if logged in) |

**Body (multipart/form-data):**
| Field           | Type   | Required | Description                       |
|-----------------|--------|----------|-----------------------------------|
| `vir_nonce`     | string | Yes      | Public nonce from VIR config      |
| `issue_type`    | select | Yes      | Type of issue (see below)         |
| `description`   | text   | Yes      | Description of the problem        |
| `screenshot`    | file   | No       | Screenshot image (max 3MB)        |
| `post_id`       | int    | Yes      | Episode/anime post ID             |

**Issue Types:**
- `broken` - Video won't play / broken
- `wrong_episode` - Wrong episode
- `no_audio` - No sound
- `desync_audio` - Audio out of sync
- `wrong_sub` - Wrong subtitles
- `missing_sub` - Missing subtitles
- `wrong_dub` - Wrong dub / language
- `stutter` - Stutter / buffering
- `nsfw` - Inappropriate content
- `other` - Other

**Example:**
```javascript
const formData = new FormData();
formData.append('vir_nonce', '5d325f4d04');
formData.append('issue_type', 'broken');
formData.append('description', 'Video does not load');
formData.append('post_id', '29663');
// formData.append('screenshot', fileInput.files[0]);

fetch("https://aniwatchtv.by/wp-json/vir/v1/report", {
  method: "POST",
  body: formData,
  credentials: "same-origin"
});
```

**Response:**
```json
{ "ok": true }
```

---

### 4.2 Report Status

```
POST /wp-json/vir/v1/status
```

**Purpose:** Check report status or submit status updates.

---

### 4.3 Telegram Notification

```
POST /wp-json/vir/v1/telegram
```

**Purpose:** Likely sends report notifications to Telegram.

---

## 5. oEmbed API

### 5.1 Get Embed Info

```
GET /wp-json/oembed/1.0/embed?url={page_url}
```

**Parameters:**
| Parameter | Type   | Required | Description            |
|-----------|--------|----------|------------------------|
| `url`     | string | Yes      | Full URL of the page   |
| `format`  | string | No       | `json` or `xml`        |

**Example:**
```javascript
fetch("https://aniwatchtv.by/wp-json/oembed/1.0/embed?url=https://aniwatchtv.by/anime/wistoria-wand-and-sword-season-2/", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

**Response:**
```json
{
  "version": "1.0",
  "provider_name": "Aniwatch",
  "provider_url": "https://aniwatchtv.by",
  "author_name": "AnimeGuru",
  "title": "Watch Wistoria: Wand and Sword Season 2 on Aniwatch",
  "type": "rich",
  "width": 600,
  "height": 338,
  "html": "<blockquote class=\"wp-embedded-content\">...</blockquote><iframe ...></iframe>",
  "thumbnail_url": "https://i1.wp.com/aniwatchtv.by/wp-content/uploads/2026/04/tsue-to-tsurugi-no-wistoria-season-2.jpg",
  "thumbnail_width": 424,
  "thumbnail_height": 600,
  "description": "Watch and Download Wistoria: Wand and Sword Season 2 with English sub and dub..."
}
```

---

### 5.2 Embed Page

Any anime or episode page can be embedded via the `/embed/` suffix:

```
GET {BASE_URL}/anime/{anime-slug}/embed/
GET {BASE_URL}/{episode-slug}/embed/
```

---

## 6. RSS Feeds

### 6.1 Main Feed (Latest Episodes)

```
GET /feed/
```

Returns RSS 2.0 with the latest episode posts.

**Example Entry:**
```xml
<item>
  <title>Iron Wok Jan! Episode 1 English Subbed</title>
  <link>https://aniwatchtv.by/iron-wok-jan-episode-1-english-subbed/</link>
  <pubDate>Sun, 05 Jul 2026 09:39:00 +0000</pubDate>
  <category><![CDATA[Iron Wok Jan!]]></category>
  <guid>https://aniwatchtv.by/iron-wok-jan-episode-1-english-subbed/</guid>
</item>
```

---

### 6.2 Category Feed (Episodes of a Series)

```
GET /category/{category-slug}/feed/
```

**Example:**
```
GET https://aniwatchtv.by/category/iron-wok-jan/feed/
```

---

### 6.3 Search Feed

```
GET /search/{keyword}/feed/rss2/
```

**Example:**
```
GET https://aniwatchtv.by/search/black+clover/feed/rss2/
```

---

## 7. Search & Discovery

### 7.1 Site Search

```
GET /?s={keyword}
```

Returns HTML search results page.

**Example:**
```javascript
fetch("https://aniwatchtv.by/?s=black+clover", {
  headers: { "User-Agent": "Mozilla/5.0" }
});
```

---

### 7.2 Anime Archive / Directory

```
GET /anime/
GET /anime/page/{n}/
```

Query parameters for filtering:
| Parameter | Description                        | Example                    |
|-----------|------------------------------------|----------------------------|
| `status`  | ongoing, completed                 | `?status=ongoing`          |
| `type`    | tv, movie, ova, ona, special       | `?type=tv`                 |
| `order`   | update, popular, title, latest     | `?order=update`            |
| `genre`   | Genre slug                         | (uses URL path)            |
| `season`  | Season slug                        | (uses URL path)            |
| `studio`  | Studio slug                        | (uses URL path)            |

---

### 7.3 Genre Pages

```
GET /genres/{genre-slug}/
GET /genres/{genre-slug}/page/{n}/
```

**Example Genres:**
- `/genres/action/` - Action anime
- `/genres/fantasy/` - Fantasy anime
- `/genres/comedy/` - Comedy anime
- `/genres/supernatural/` - Supernatural anime

---

### 7.4 Season Pages

```
GET /season/{season-slug}/
```

**Example Seasons:**
- `/season/spring-2026/` - Spring 2026
- `/season/winter-2026/` - Winter 2026
- `/season/fall-2025/` - Fall 2025
- `/season/summer-2025/` - Summer 2025

---

### 7.5 Studio Pages

```
GET /studio/{studio-slug}/
```

**Example:**
- `/studio/actas/` - Actas studio
- `/studio/bandai-namco-pictures/` - Bandai Namco Pictures

---

### 7.6 Country Pages

```
GET /country/{country-slug}/
```

**Example:**
- `/country/japan/` - Japanese anime

---

## 8. URL Structure Patterns

### 8.1 Anime Series Page
```
{BASE_URL}/anime/{anime-slug}/
```
**Example:** `https://aniwatchtv.by/anime/wistoria-wand-and-sword-season-2/`

**HTML Parsing for Episode List:**
```python
# Episodes are in .eplister > ul > li
eps = soup.select('.eplister ul li')
for ep in eps:
    num = ep.select_one('.epl-num').text
    title = ep.select_one('.epl-title').text
    link = ep.find('a')['href']
```

---

### 8.2 Episode Watch Page
```
{BASE_URL}/{anime-slug}-episode-{number}-english-subbed/
{BASE_URL}/{anime-slug}-episode-{number}-english-dubbed/
```

**Example:**
- Sub: `https://aniwatchtv.by/wistoria-wand-and-sword-season-2-episode-12-english-subbed/`
- Dub: `https://aniwatchtv.by/...-episode-12-english-dubbed/`

**HTML Parsing for Video:**
```python
# Get iframe src
iframe = soup.find('div', id='pembed').find('iframe')
player_url = iframe['src']  # Contains source= and url= params

# Get anime info from meta/Schema.org JSON-LD
# Get episode navigation from .video-nav
```

---

### 8.3 Common URL Patterns

| Pattern                          | Example                                          |
|----------------------------------|--------------------------------------------------|
| Home                             | `/`                                              |
| Anime Archive                    | `/anime/`                                        |
| Anime Detail                     | `/anime/{slug}/`                                 |
| Episode Watch                    | `/{slug}-episode-{n}-english-subbed/`            |
| Genre                            | `/genres/{slug}/`                                |
| Season                           | `/season/{slug}/`                                |
| Studio                           | `/studio/{slug}/`                                |
| Country                          | `/country/{slug}/`                               |
| Author                           | `/author/animeguru/`                             |
| Search                           | `/?s={keyword}`                                  |
| Feed                             | `/feed/`                                         |
| Embed                            | `/{path}/embed/`                                 |
| Text Mode List                   | `/anime/list-mode/`                              |

---

## 9. Site Configuration

### 9.1 Global ts_config Object

Found in every page's inline script:
```javascript
const ts_config = {
  "general": {
    "ajaxurl": "https://aniwatchtv.by/wp-admin/admin-ajax.php",
    "site_url": "https://aniwatchtv.by",
    "slow_view_count": true,
    "display_view_count": false,
    "slow_view_count_interval": 6  // hours
  },
  "lang": {
    "bookmarked_label": "Bookmarked",
    "bookmark_label": "Bookmark",
    "bookmark_max_reached": "You have reached the maximum bookmark limit"
  },
  "bookmark": {
    "max": "50",
    "enabled": true
  }
};
```

---

### 9.2 Authentication

- **Logged-out users:** Bookmarks stored in `localStorage` only
- **Logged-in users:** Bookmarks synced via AJAX (`bookmark_push`, `bookmark_remove`)
- **Max bookmarks:** 50
- **No auth required** for viewing videos, searching, or browsing
- **REST API nonces** (`X-WP-Nonce`) only needed for logged-in actions

---

### 9.3 Response Headers / CORS

- WordPress REST API endpoints respond with proper CORS headers
- `Access-Control-Allow-Origin: *` on REST endpoints
- Admin AJAX requires `X-Requested-With: XMLHttpRequest` header
- Episode pages set `Referrer-Policy` and may validate Referer on player

---

## 10. Complete Workflow Examples

### 10.1 Watch an Episode (Full Flow)

```javascript
async function watchEpisode(animeSlug, episodeNum) {
  const BASE = "https://aniwatchtv.by";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": BASE
  };

  // Step 1: Get episode page
  const epUrl = `${BASE}/${animeSlug}-episode-${episodeNum}-english-subbed/`;
  const resp = await fetch(epUrl, { headers });
  const html = await resp.text();

  // Step 2: Extract player iframe URL
  const iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/);
  if (!iframeMatch) throw new Error("No video found");

  // Step 3: Fetch player page
  const playerResp = await fetch(iframeMatch[1], { headers });
  const playerHtml = await playerResp.text();

  // Step 4: Extract direct video URL
  const fileUrl = playerHtml.match(/var fileUrl = "([^"]+)"/)[1];
  const sources = JSON.parse(playerHtml.match(/var sources = (\[.*?\]);/s)[1]);
  const thumbUrl = playerHtml.match(/var thumbUrl = "([^"]*)"/)?.[1];

  return {
    videoUrl: fileUrl,
    qualities: sources.map(s => ({ label: s.label, url: s.file })),
    thumbnail: thumbUrl
  };
}

// Usage
watchEpisode("wistoria-wand-and-sword-season-2", "12")
  .then(data => console.log(data));
```

---

### 10.2 Browse Anime by Genre

```javascript
async function getAnimeByGenre(genreSlug, page = 1) {
  const url = `https://aniwatchtv.by/genres/${genreSlug}/page/${page}/`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  // Parse HTML to extract anime cards
  // Each anime: .bsx > a[href] > .limit > .typez (status) + .tt (title)
}
```

---

### 10.3 List All Episodes of a Series

```javascript
async function getEpisodes(categoryId, perPage = 100) {
  const url = `https://aniwatchtv.by/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${perPage}&orderby=date&order=desc`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return await resp.json(); // Array of episode posts
}

// Get category ID first by listing categories
async function findCategory(animeName) {
  const url = `https://aniwatchtv.by/wp-json/wp/v2/categories?search=${encodeURIComponent(animeName)}&per_page=10`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return await resp.json();
}
```

---

### 10.4 Search for Anime

```javascript
async function searchAnime(keyword) {
  const url = `https://aniwatchtv.by/wp-json/wp/v2/posts?search=${encodeURIComponent(keyword)}&per_page=20`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const episodes = await resp.json();

  // Group by category (anime series)
  const series = {};
  for (const ep of episodes) {
    for (const catId of ep.categories) {
      if (!series[catId]) series[catId] = [];
      series[catId].push(ep);
    }
  }
  return series;
}
```

---

## 11. JavaScript Assets

| File | Purpose |
|------|---------|
| `/wp-content/themes/animestream/assets/js/jquery.min.js` | jQuery 3.7.1 |
| `/wp-content/themes/animestream/assets/js/tsfn.js` | Core theme functions (views, bookmarks, hooks) |
| `/wp-content/themes/animestream/assets/js/tsevents.js` | Event handlers |
| `/wp-content/themes/animestream/assets/js/filter.js` | Filter UI logic |
| `/wp-content/themes/animestream/assets/js/bookmark.js` | Bookmark system (localStorage + AJAX) |
| `/wp-content/themes/animestream/assets/js/popular_widget.js` | Popular anime widget |
| `/wp-content/themes/animestream/assets/js/owl.carousel.min.js` | Carousel slider |
| `/wp-content/themes/animestream/assets/js/jquery.qtip.min.js` | Tooltip library |
| `/wp-content/plugins/video-issue-reporter/assets/js/report.js` | Video issue report form |

---

## 12. Data Model

### 12.1 Episode (WordPress Post)
- **Post Type:** `post`
- **Category:** Anime series (one category per series)
- **Featured Image:** Episode thumbnail
- **Content:** Generic description text
- **Slug Pattern:** `{anime-slug}-episode-{number}-english-subbed`

### 12.2 Anime (Custom Post Type)
- **Post Type:** `anime` (not exposed via REST by default)
- **Taxonomies:** `category` (genres as sub-cats), `post_tag`, `series_franchise`
- **Meta:** Status, Studio, Season, Country, Type
- **Featured Image:** Anime poster/cover

### 12.3 Genre
- Implemented as **parent categories** or custom taxonomy
- URL: `/genres/{slug}/`

### 12.4 Video Sources
- **Primary:** Blogger/Google Video CDN (`*.googlevideo.com`)
- **Format:** MP4 (H.264)
- **Qualities:** Usually 360p, sometimes 720p
- **Player:** JW Player 8.x
- **DRM:** None (direct URLs)
- **Expiration:** URLs are time-signed and expire in ~8 hours

---

## 13. Important Notes

1. **Rate Limiting:** WordPress does not enforce strict rate limiting, but excessive requests may trigger security plugins.

2. **Authentication:** Most endpoints are public. No API key needed for reading.

3. **Video URL Expiration:** Google Video URLs expire after a few hours. Always fetch fresh from the player page.

4. **Referer Check:** The player may validate the `Referer` header. Set it to `https://aniwatchtv.by/`.

5. **CORS:** REST API endpoints have `Access-Control-Allow-Origin: *`. Admin AJAX requires same-origin or proper headers.

6. **User-Agent:** Required for all requests. Use a standard browser UA string.

7. **Bookmarks:** Guest bookmarks are localStorage-only. Sync to server requires login.

8. **Search Limitation:** The WP REST search (`?search=`) may not index all content effectively. HTML scraping the `/anime/` archive or using RSS feeds may be more reliable for discovery.

9. **Image CDN:** Site uses Jetpack Photon (`i0.wp.com`, `i1.wp.com`) for image optimization.

10. **Cache Busting:** The theme uses `ts_ajax_cache_buster` for timestamp-based cache invalidation.

---

*Document compiled from thorough crawling of aniwatchtv.by on 2026-07-05. All endpoints are publicly accessible and do not require authentication unless explicitly noted.*
