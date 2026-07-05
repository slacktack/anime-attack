import { expect, test } from "vitest";
import { buildPrompt } from "./prompts";

test("summary prompt embeds spoiler ceiling", () => {
  const { system, user } = buildPrompt({ task: "summary", animeTitle: "Black Clover", ceiling: 41 });
  expect(system).toMatch(/episode 41/i);
  expect(system).toMatch(/do not reveal/i);
  expect(user).toMatch(/Black Clover/);
});

test("ceiling 0 means spoiler-free setup only", () => {
  const { system } = buildPrompt({ task: "chat", animeTitle: "X", ceiling: 0, question: "who wins?" });
  expect(system).toMatch(/no episodes/i);
});

test("chat prompt includes the question", () => {
  const { user } = buildPrompt({ task: "chat", animeTitle: "X", ceiling: 5, question: "Who is Yami?" });
  expect(user).toMatch(/Who is Yami\?/);
});
