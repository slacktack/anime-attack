import { afterEach, expect, test, vi } from "vitest";
import { callGemini, getKeyPool } from "./gemini";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

test("getKeyPool parses comma-separated pool and trims", () => {
  vi.stubEnv("GEMINI_API_KEYS", " a , b ,, c ");
  vi.stubEnv("GEMINI_API_KEY", "");
  expect(getKeyPool()).toEqual(["a", "b", "c"]);
});

test("getKeyPool falls back to single key", () => {
  vi.stubEnv("GEMINI_API_KEYS", "");
  vi.stubEnv("GEMINI_API_KEY", "solo");
  expect(getKeyPool()).toEqual(["solo"]);
});

test("callGemini returns concatenated text", async () => {
  vi.stubEnv("GEMINI_API_KEYS", "k");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "Hello" }, { text: " world" }] } }],
  }), { status: 200 })));
  expect(await callGemini("sys", "hi")).toBe("Hello world");
});

test("callGemini fails over to next key on 429", async () => {
  vi.stubEnv("GEMINI_API_KEYS", "bad,good");
  vi.stubEnv("GEMINI_API_KEY", "");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("quota", { status: 429 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await callGemini("s", "u")).toBe("ok");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("callGemini throws when pool empty", async () => {
  vi.stubEnv("GEMINI_API_KEYS", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  await expect(callGemini("s", "u")).rejects.toThrow(/no gemini/i);
});
