import { expect, test } from "vitest";
import { htmlToText } from "./htmlToText";

test("converts <br> to newlines", () => {
  expect(htmlToText("A<br><br>B (Source: X)")).toBe("A\n\nB (Source: X)");
});

test("strips tags and decodes entities", () => {
  expect(htmlToText("<i>hi</i>&amp;bye")).toBe("hi&bye");
});
