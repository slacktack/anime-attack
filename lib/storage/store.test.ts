import { beforeEach, expect, test } from "vitest";
import { getSpoilerCeiling, setSpoilerCeiling, toggleFavorite, isFavorite, recordProgress, getContinueWatching } from "./store";

const item = { id: 1, title: "Black Clover", cover: "c", banner: null, type: "TV", score: 7.3, year: 2017 };

beforeEach(() => localStorage.clear());

test("spoiler ceiling defaults to 0 and persists", () => {
  expect(getSpoilerCeiling(1)).toBe(0);
  setSpoilerCeiling(1, 41);
  expect(getSpoilerCeiling(1)).toBe(41);
});

test("toggle favorite flips state", () => {
  expect(toggleFavorite(item)).toBe(true);
  expect(isFavorite(1)).toBe(true);
  expect(toggleFavorite(item)).toBe(false);
  expect(isFavorite(1)).toBe(false);
});

test("continue watching sorts most-recent first", () => {
  recordProgress(item, 5);
  recordProgress({ ...item, id: 2, title: "B" }, 3);
  const cw = getContinueWatching();
  expect(cw[0].anime.id).toBe(2);
  expect(cw[0].episode).toBe(3);
});
