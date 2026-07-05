const MODEL = "gemini-2.5-flash";

// Round-robin cursor across the key pool. Module-level so it survives between
// requests in the same server process; no Date.now/Math.random (test-safe).
let cursor = 0;

export function getKeyPool(): string[] {
  const pool = (process.env.GEMINI_API_KEYS ?? "")
    .split(",").map((k) => k.trim()).filter(Boolean);
  if (pool.length > 0) return pool;
  const solo = (process.env.GEMINI_API_KEY ?? "").trim();
  return solo ? [solo] : [];
}

async function tryKey(key: string, system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

export async function callGemini(system: string, user: string): Promise<string> {
  const pool = getKeyPool();
  if (pool.length === 0) throw new Error("No Gemini API keys configured");
  const start = cursor % pool.length;
  cursor = (cursor + 1) % pool.length;
  let lastErr: unknown;
  for (let i = 0; i < pool.length; i++) {
    const key = pool[(start + i) % pool.length];
    try {
      return await tryKey(key, system, user);
    } catch (err) {
      lastErr = err; // quota/429/5xx or network — advance to the next key
    }
  }
  throw new Error(`All Gemini keys failed: ${String(lastErr)}`);
}
