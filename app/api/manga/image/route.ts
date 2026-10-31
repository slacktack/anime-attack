import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA = "AnimeAttack/1.0 (https://github.com/slacktack/anime-attack)";
const ALLOWED_HOSTS = ["uploads.mangadex.org", "mangadex.org", "mangadex.network"];

function allowed(hostname: string): boolean {
  return ALLOWED_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

function fallbackFor(url: URL): string | null {
  if (url.hostname === "uploads.mangadex.org") return null;
  if (!url.hostname.endsWith("mangadex.network")) return null;
  return `https://uploads.mangadex.org${url.pathname}${url.search}`;
}

async function grab(target: string): Promise<Response | null> {
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://mangadex.org/",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const length = Number(res.headers.get("content-length") ?? "0");
    if (length === 0) return null;
    return res;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing image url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid image url" }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol) || !allowed(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const candidates = [target.href];
  const fallback = fallbackFor(target);
  if (fallback) candidates.push(fallback);

  for (const candidate of candidates) {
    const upstream = await grab(candidate);
    if (!upstream) continue;
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  }

  return NextResponse.json(
    { error: "Image unavailable" },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
