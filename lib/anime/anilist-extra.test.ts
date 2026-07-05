import { afterEach, expect, test, vi } from "vitest";
import { browseCharacters } from "./anilist-extra";

afterEach(() => vi.restoreAllMocks());

test("browseCharacters maps id/name/image/favourites in returned order", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    data: {
      Page: {
        characters: [
          { id: 1, name: { full: "Lelouch" }, image: { large: "lelouch.jpg" }, favourites: 500 },
          { id: 2, name: { full: "Light Yagami" }, image: { large: "light.jpg" }, favourites: 300 },
        ],
      },
    },
  }), { status: 200 })));

  const res = await browseCharacters();

  expect(res).toEqual([
    { id: 1, name: "Lelouch", image: "lelouch.jpg", favourites: 500 },
    { id: 2, name: "Light Yagami", image: "light.jpg", favourites: 300 },
  ]);
});
