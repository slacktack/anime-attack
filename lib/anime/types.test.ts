import { expect, test } from "vitest";
import { AnimeSummarySchema } from "./types";

test("AnimeSummarySchema parses a valid summary", () => {
  const parsed = AnimeSummarySchema.parse({
    id: 1, title: "Black Clover", cover: "http://x/y.jpg",
    banner: null, type: "TV", score: 7.29, year: 2017,
  });
  expect(parsed.title).toBe("Black Clover");
});

test("AnimeSummarySchema rejects missing id", () => {
  expect(() => AnimeSummarySchema.parse({ title: "x" })).toThrow();
});
