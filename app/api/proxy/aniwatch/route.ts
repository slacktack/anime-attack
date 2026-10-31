import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const referer = request.nextUrl.searchParams.get("ref") ?? "https://aniwatchtv.by/";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: referer,
      },
    });

    const contentType = res.headers.get("content-type") ?? "text/plain";

    const cacheHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
    };

    // Return JSON or text depending on response
    if (contentType.includes("application/json")) {
      const json = await res.json();
      return NextResponse.json(json, { headers: cacheHeaders });
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        ...cacheHeaders,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
