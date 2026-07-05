import { afterEach, expect, test, vi } from "vitest";
import { searchKitsu } from "./kitsu";

afterEach(() => vi.restoreAllMocks());

test("maps kitsu search results to AnimeSummary", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "1",
              attributes: {
                titles: { en: "Cowboy Bebop" },
                canonicalTitle: "Cowboy Bebop",
                posterImage: { original: "https://example.com/poster.jpg", large: "https://example.com/large.jpg" },
                coverImage: { original: "https://example.com/cover.jpg" },
                subtype: "TV",
                averageRating: "86.5",
                startDate: "1998-04-03",
              },
            },
          ],
        }),
        { status: 200 }
      )
    )
  );
  const results = await searchKitsu("cowboy");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: 1,
    title: "Cowboy Bebop",
    cover: "https://example.com/poster.jpg",
    banner: "https://example.com/cover.jpg",
    type: "TV",
    score: 8.7,
    year: 1998,
  });
});

test("returns [] on fetch failure", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
  expect(await searchKitsu("cowboy")).toEqual([]);
});
