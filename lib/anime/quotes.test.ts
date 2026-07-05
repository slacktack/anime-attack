import { afterEach, expect, test, vi } from "vitest";
import { getRandomQuote } from "./quotes";

afterEach(() => vi.restoreAllMocks());

test("maps animechan response to quote", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            content: "You should enjoy the little things in life.",
            anime: { name: "Fullmetal Alchemist" },
            character: { name: "Kenny Ackerman" },
          },
        }),
        { status: 200 }
      )
    )
  );
  const quote = await getRandomQuote();
  expect(quote).toEqual({
    anime: "Fullmetal Alchemist",
    character: "Kenny Ackerman",
    quote: "You should enjoy the little things in life.",
  });
});

test("returns null on fetch failure", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
  expect(await getRandomQuote()).toBeNull();
});
