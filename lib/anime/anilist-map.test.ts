import { expect, test } from "vitest";
import { mapMediaToSummary, mapMediaToAnime } from "./anilist-map";

const media = {
  id: 100, title: { english: "Black Clover", romaji: "Black Clover" },
  coverImage: { large: "http://x/cover.jpg" }, bannerImage: "http://x/banner.jpg",
  format: "TV", averageScore: 73, seasonYear: 2017,
  description: "Asta...", genres: ["Action"], status: "FINISHED", episodes: 170,
  studios: { nodes: [{ name: "Pierrot" }] },
};

test("maps summary, score scaled to 10", () => {
  const s = mapMediaToSummary(media);
  expect(s.title).toBe("Black Clover");
  expect(s.score).toBe(7.3);
  expect(s.type).toBe("TV");
});

test("maps full anime with genres and studios", () => {
  const a = mapMediaToAnime(media);
  expect(a.genres).toEqual(["Action"]);
  expect(a.studios).toEqual(["Pierrot"]);
  expect(a.episodes).toBe(170);
});
