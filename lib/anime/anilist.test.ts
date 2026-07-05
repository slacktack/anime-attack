import { afterEach, expect, test, vi } from "vitest";
import { getTrending } from "./anilist";

afterEach(() => vi.restoreAllMocks());

test("getTrending maps media list", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    data: { Page: { media: [{ id: 1, title: { english: "X" }, coverImage: { large: "c" }, format: "TV", averageScore: 80 }] } },
  }), { status: 200 })));
  const res = await getTrending();
  expect(res[0].title).toBe("X");
  expect(res[0].score).toBe(8);
});
