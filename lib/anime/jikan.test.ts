import { afterEach, expect, test, vi } from "vitest";
import { getEpisodesByMal } from "./jikan";

afterEach(() => vi.restoreAllMocks());

test("maps jikan episodes with filler flag", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    data: [{ mal_id: 1, title: "Asta and Yuno", filler: false }, { mal_id: 2, title: "Filler ep", filler: true }],
    pagination: { has_next_page: false },
  }), { status: 200 })));
  const eps = await getEpisodesByMal(30);
  expect(eps).toHaveLength(2);
  expect(eps[1].filler).toBe(true);
});

test("returns [] on fetch failure", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
  expect(await getEpisodesByMal(30)).toEqual([]);
});
