import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Deliberately the short UA (no "(KHTML, like Gecko) Chrome/…" suffix).
// Google Video's `videoplayback` endpoint answers 403 to the full Chrome UA string
// and 206 to this one — measured 4/4 both ways on 2026-10-31 — which would make the
// aniwatch MP4 fallback from /api/anime/source unplayable. megavid accepts either.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

function jsonError(message: string, status = 502) {
  return NextResponse.json({ error: message }, { status, headers: CORS });
}

function proxied(origin: string, absolute: string, ref: string, mode: string) {
  return `${origin}/api/proxy/media?url=${encodeURIComponent(absolute)}&ref=${encodeURIComponent(ref)}&mode=${mode}`;
}

function absUrl(uri: string, base: string): string | null {
  try {
    return new URL(uri, base).toString();
  } catch {
    return null;
  }
}

/**
 * Hosts that serve media segments with permissive CORS, so the browser can fetch
 * them directly. Everything else is proxied even in "smart" mode: megavid-family
 * hosts answer direct cross-origin segment requests with 403 unless a megavid
 * Referer is present, which a browser never sends from our origin.
 */
const DIRECT_SEGMENT_HOSTS = ["echovideo.to"];

function hostAllowsDirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return DIRECT_SEGMENT_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function rewritePlaylist(
  text: string,
  baseUrl: string,
  origin: string,
  ref: string,
  mode: "smart" | "full",
): string {
  const isMaster = /#EXT-X-STREAM-INF/i.test(text) || /#EXT-X-MEDIA:/i.test(text);

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (match, uri: string) => {
          const absolute = absUrl(uri, baseUrl);
          return absolute ? `URI="${proxied(origin, absolute, ref, mode)}"` : match;
        });
      }

      const absolute = absUrl(trimmed, baseUrl);
      if (!absolute) return line;

      if (isMaster) return proxied(origin, absolute, ref, mode);
      if (mode === "full") return proxied(origin, absolute, ref, mode);
      return hostAllowsDirect(absolute) ? absolute : proxied(origin, absolute, ref, mode);
    })
    .join("\n");
}

function isPlaylistBody(chunk: Uint8Array): boolean {
  const head = new TextDecoder().decode(chunk.slice(0, 48)).trimStart();
  return head.startsWith("#EXTM3U");
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function drain(reader: ReadableStreamDefaultReader<Uint8Array>, first: Uint8Array) {
  let all = first;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) all = concat(all, value);
  }
  return all;
}

function toVtt(text: string): string {
  let out = text.replace(/^\uFEFF/, "").trimStart();
  if (out.startsWith("WEBVTT")) return out;
  out = out.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${out}`;
}

function isSubtitleUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(vtt|srt|ass|ssa|txt)$/.test(path);
  } catch {
    return false;
  }
}

// megavid disguises TS segments as .txt/.jpg/etc, so sniff bytes before treating as text.
function looksBinaryMedia(chunk: Uint8Array): boolean {
  if (chunk.length === 0) return false;
  if (chunk[0] === 0x47) return true;
  const n = Math.min(chunk.length, 512);
  for (let i = 0; i < n; i++) if (chunk[i] === 0) return true;
  return false;
}

function baseHeaders(contentType: string, extra?: Record<string, string>): Record<string, string> {
  return { ...CORS, "Content-Type": contentType, ...extra };
}

function originOf(ref: string): Record<string, string> {
  try {
    return { Origin: new URL(ref).origin };
  } catch {
    return {};
  }
}

// megavid drops the odd request under load; one quick retry hides it from the player
async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(attempt === 0 ? 20_000 : 15_000),
      });
      if (res.status < 500 && res.status !== 429) return res;
      last = res;
    } catch (error) {
      last = error;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  if (last instanceof Response) return last;
  throw last instanceof Error ? last : new Error("Upstream fetch failed");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = params.get("url");
  if (!target) return jsonError("Missing url parameter", 400);

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return jsonError("Invalid url parameter", 400);
  }
  if (!/^https?:$/.test(targetUrl.protocol)) return jsonError("Unsupported protocol", 400);

  const mode: "smart" | "full" = params.get("mode") === "full" ? "full" : "smart";
  const origin = request.nextUrl.origin;
  const ref = params.get("ref") || `${targetUrl.protocol}//${targetUrl.host}/`;
  const range = request.headers.get("range");

  try {
    const upstream = await fetchWithRetry(targetUrl.toString(), {
      "User-Agent": UA,
      Referer: ref,
      ...originOf(ref),
      Accept: "*/*",
      ...(range ? { Range: range } : {}),
    });

    if (!upstream.ok) {
      return jsonError(`Upstream returned ${upstream.status}`, upstream.status === 404 ? 404 : 502);
    }

    const upstreamType = upstream.headers.get("content-type") ?? "";
    const looksPlaylist =
      /mpegurl/i.test(upstreamType) ||
      /\.m3u8/i.test(targetUrl.pathname) ||
      /[?&][tv]\.m3u8/i.test(targetUrl.search) ||
      /\.m3u8/i.test(upstream.url);

    const status = upstream.status === 206 ? 206 : 200;
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges") ?? "bytes";

    if (looksPlaylist) {
      const text = await upstream.text();
      const rewritten = rewritePlaylist(text, upstream.url, origin, ref, mode);
      return new NextResponse(rewritten, {
        status,
        headers: baseHeaders("application/vnd.apple.mpegurl", {
          "Cache-Control": "public, s-maxage=4, stale-while-revalidate=10",
          "Accept-Ranges": acceptRanges,
        }),
      });
    }

    if (!upstream.body) {
      return new NextResponse(null, {
        status,
        headers: baseHeaders(upstreamType || "application/octet-stream", {
          ...(contentRange ? { "Content-Range": contentRange } : {}),
          "Accept-Ranges": acceptRanges,
        }),
      });
    }

    const reader = upstream.body.getReader();
    const first = await reader.read();

    if (first.done) {
      return new NextResponse(null, {
        status,
        headers: baseHeaders(upstreamType || "application/octet-stream", {
          ...(contentRange ? { "Content-Range": contentRange } : {}),
          "Accept-Ranges": acceptRanges,
        }),
      });
    }

    const firstChunk = first.value ?? new Uint8Array(0);

    if (isPlaylistBody(firstChunk)) {
      const all = await drain(reader, firstChunk);
      const text = new TextDecoder().decode(all);
      const rewritten = rewritePlaylist(text, upstream.url, origin, ref, mode);
      return new NextResponse(rewritten, {
        status,
        headers: baseHeaders("application/vnd.apple.mpegurl", {
          "Cache-Control": "public, s-maxage=4, stale-while-revalidate=10",
        }),
      });
    }

    if (isSubtitleUrl(targetUrl.toString()) && !looksBinaryMedia(firstChunk)) {
      const all = await drain(reader, firstChunk);
      const text = new TextDecoder().decode(all);
      return new NextResponse(toVtt(text), {
        status,
        headers: baseHeaders("text/vtt; charset=utf-8", {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        }),
      });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(firstChunk);
        const pump = async () => {
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              if (value) controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        };
        void pump();
      },
      cancel(reason) {
        void reader.cancel(reason);
      },
    });

    const contentLength = upstream.headers.get("content-length");
    const encoding = upstream.headers.get("content-encoding");

    return new NextResponse(stream, {
      status,
      headers: baseHeaders(upstreamType || "application/octet-stream", {
        ...(contentLength && !encoding ? { "Content-Length": contentLength } : {}),
        ...(contentRange ? { "Content-Range": contentRange } : {}),
        "Accept-Ranges": acceptRanges,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      }),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Proxy request failed");
  }
}

export async function HEAD(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) return new NextResponse(null, { status: 400, headers: CORS });

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": UA, Referer: "https://megavid.buzz/" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const headers = baseHeaders(res.headers.get("content-type") ?? "application/octet-stream", {
      "Accept-Ranges": res.headers.get("accept-ranges") ?? "bytes",
      "Cache-Control": "public, max-age=3600",
    });
    return new NextResponse(null, { status: res.status, headers });
  } catch {
    return new NextResponse(null, { status: 502, headers: CORS });
  }
}
