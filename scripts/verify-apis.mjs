#!/usr/bin/env node
/**
 * Verifies every internal API endpoint against a running server.
 *
 *   node scripts/verify-apis.mjs [baseUrl]
 *
 * Exit code 0 only when every check passes, so CI or a pre-deploy hook can gate on it.
 */

const BASE = process.argv[2] || "http://localhost:3100";

const checks = [
  {
    name: "discover · trending",
    path: "/api/anime/discover?kind=trending",
    expect: (d) => d.items?.length > 0 && d.items[0].title,
  },
  { name: "discover · airing", path: "/api/anime/discover?kind=airing", expect: (d) => d.items?.length > 0 },
  { name: "discover · movies", path: "/api/anime/discover?kind=movies", expect: (d) => d.items?.length > 0 },
  {
    name: "discover · search",
    path: "/api/anime/discover?kind=search&q=naruto",
    expect: (d) => d.items?.length > 0,
  },
  {
    name: "discover · browse filters",
    path: "/api/anime/discover?kind=browse&genre=Action&sort=SCORE_DESC",
    expect: (d) => d.items?.length > 0,
  },
  {
    name: "anime detail (aggregated)",
    path: "/api/anime/97940",
    expect: (d) =>
      d.anime?.title === "Black Clover" && d.malId === 34572 && d.relations?.length > 0 && d.characters?.length > 0,
  },
  {
    name: "anime episodes (long-runner)",
    path: "/api/anime/episodes?mal=21",
    expect: (d) => d.episodes?.length > 1000 && d.episodes.some((e) => e.number === 650),
  },
  { name: "aniwatch latest feed", path: "/api/anime/latest?per_page=5", expect: (d) => d.items?.length > 0 },
  { name: "aniwatch feed search", path: "/api/anime/latest?q=naruto", expect: (d) => Array.isArray(d.items) },
  { name: "characters browse", path: "/api/characters?page=1", expect: (d) => d.items?.length > 0 },
  { name: "character detail", path: "/api/characters/17", expect: (d) => d.character?.name?.includes("Naruto") },
  { name: "airing schedule", path: "/api/schedule", expect: (d) => d.items?.length > 0 },
  { name: "manga search (readable)", path: "/api/manga/search?order=readable", expect: (d) => d.items?.length > 0 },
  {
    name: "manga detail",
    path: "/api/manga/32d76d19-8a05-4db0-9fc2-e0b0648fe9d0",
    expect: (d) => d.title && Array.isArray(d.chapters),
  },
  {
    name: "manga chapter pages",
    path: "/api/manga/chapter/d5431b60-a7c2-49b5-ac5c-872d02ab05c8",
    expect: (d) => d.pages?.length > 0 && d.pages[0].startsWith("/api/manga/image"),
  },
  {
    name: "stream · by MAL id",
    path: "/api/anime/source?mal=1535&ep=1&audio=sub",
    expect: (d) => d.status === "ok" && d.source?.startsWith("http"),
  },
  {
    name: "stream · slug-only fallback",
    path: "/api/anime/source?slug=one-piece-episode-650&audio=sub",
    expect: (d) => d.status === "ok" && d.malId === 21 && d.episode === 650,
  },
  {
    name: "stream · dub",
    path: "/api/anime/source?mal=1535&ep=1&audio=dub",
    expect: (d) => d.status === "ok" || d.status === "missing",
  },
];

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (${res.status}): ${text.slice(0, 80)}`);
  }
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

let failures = 0;
console.log(`Verifying ${checks.length} endpoints against ${BASE}\n`);

for (const check of checks) {
  const started = Date.now();
  try {
    const json = await fetchJson(check.path);
    const ok = check.expect(json);
    const ms = Date.now() - started;
    if (!ok) throw new Error("unexpected payload shape");
    console.log(`  PASS  ${check.name.padEnd(34)} ${String(ms).padStart(5)}ms  ${check.path}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${check.name.padEnd(34)} ${error.message}`);
    console.log(`        ${check.path}`);
  }
}

// Media proxy chain: master playlist -> variant -> first segment.
async function verifyProxyChain() {
  const label = "media proxy chain (master→segment)";
  try {
    const src = await fetchJson("/api/anime/source?mal=1535&ep=1&audio=sub");
    if (!src.source) throw new Error("no source to proxy");
    const master = await fetch(
      `${BASE}/api/proxy/media?url=${encodeURIComponent(src.source)}&ref=${encodeURIComponent(
        "https://megavid.buzz/",
      )}&mode=smart`,
    );
    if (!master.ok) throw new Error(`master HTTP ${master.status}`);
    const masterText = await master.text();
    if (!masterText.startsWith("#EXTM3U")) throw new Error("master is not a playlist");

    const variantUrl = masterText.split("\n").find((l) => l.trim() && !l.startsWith("#"));
    if (!variantUrl) throw new Error("no variant in master");
    const variant = await fetch(variantUrl);
    if (!variant.ok) throw new Error(`variant HTTP ${variant.status}`);
    const variantText = await variant.text();
    if (!variantText.startsWith("#EXTM3U")) throw new Error("variant is not a playlist");

    const segmentUrl = variantText.split("\n").find((l) => l.trim() && !l.startsWith("#"));
    if (!segmentUrl) throw new Error("no segment in variant");
    if (!segmentUrl.includes("/api/proxy/media")) {
      throw new Error("segment is not proxied (referer gate would 403)");
    }
    const segment = await fetch(segmentUrl, { headers: { Range: "bytes=0-1023" } });
    if (!segment.ok) throw new Error(`segment HTTP ${segment.status}`);
    const bytes = new Uint8Array(await segment.arrayBuffer());
    if (bytes.length < 100) throw new Error(`segment too small (${bytes.length} bytes)`);
    console.log(`  PASS  ${label.padEnd(34)}   ok   ${bytes.length} bytes, ts sync=${bytes[0] === 0x47}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${label.padEnd(34)} ${error.message}`);
  }
}

await verifyProxyChain();

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
