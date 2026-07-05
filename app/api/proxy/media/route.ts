import { type NextRequest, NextResponse } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const REFERER = "https://aniwatchtv.by/";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const rangeHeader = request.headers.get("range");

  try {
    const upstreamRes = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: REFERER,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstreamRes.status}` },
        { status: 502 },
      );
    }

    const contentType =
      upstreamRes.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = upstreamRes.headers.get("content-length");
    const contentRange = upstreamRes.headers.get("content-range");
    const acceptRanges = upstreamRes.headers.get("accept-ranges") ?? "bytes";

    const status = upstreamRes.status === 206 ? 206 : 200;

    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      "Content-Type": contentType,
      "Accept-Ranges": acceptRanges,
      "Cache-Control": "public, max-age=3600",
    };

    if (contentLength) headers["Content-Length"] = contentLength;
    if (contentRange && status === 206) headers["Content-Range"] = contentRange;

    return new NextResponse(upstreamRes.body, { status, headers });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 },
    );
  }
}
