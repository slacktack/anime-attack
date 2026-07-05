import { expect, test } from "vitest";
import { mapMediaToSummary, mapMediaToAnime, mapCharacterEdge } from "./anilist-map";

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

test("maps full character edge", () => {
  const edge = {
    role: "MAIN",
    node: { id: 5, name: { full: "Asta", native: "アスタ" }, image: { large: "http://x/a.jpg" } },
    voiceActors: [{ name: { full: "Gakuto Kajiwara" } }],
  };
  const c = mapCharacterEdge(edge);
  expect(c.id).toBe(5);
  expect(c.name).toBe("Asta");
  expect(c.image).toBe("http://x/a.jpg");
  expect(c.role).toBe("MAIN");
  expect(c.voiceActor).toBe("Gakuto Kajiwara");
});

test("character edge name fallback: full -> native -> Unknown", () => {
  const edgeNative = {
    role: "SUPPORTING",
    node: { id: 10, name: { native: "ヤミ" }, image: { large: "http://x/yami.jpg" } },
    voiceActors: [],
  };
  const c1 = mapCharacterEdge(edgeNative);
  expect(c1.name).toBe("ヤミ");

  const edgeUnknown = {
    role: "SUPPORTING",
    node: { id: 11, name: {}, image: { large: "http://x/unknown.jpg" } },
    voiceActors: [],
  };
  const c2 = mapCharacterEdge(edgeUnknown);
  expect(c2.name).toBe("Unknown");
});

test("character edge missing voiceActors and image", () => {
  const edge = {
    role: "BACKGROUND",
    node: { id: 20, name: { full: "Minor Character" } },
  };
  const c = mapCharacterEdge(edge);
  expect(c.id).toBe(20);
  expect(c.name).toBe("Minor Character");
  expect(c.image).toBeNull();
  expect(c.voiceActor).toBeNull();
});
