import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPrompt } from "@/lib/ai/prompts";
import { callGemini } from "@/lib/ai/gemini";

export const runtime = "nodejs";

const BodySchema = z.object({
  task: z.enum(["summary", "catchup", "chat", "character", "charfacts", "charquiz", "recommend"]),
  animeTitle: z.string().min(1).max(200),
  ceiling: z.number().int().nonnegative().max(100000),
  question: z.string().max(1000).optional(),
  characterName: z.string().max(200).optional(),
  context: z.string().max(5000).optional(),
});

function isSameOrigin(req: Request): boolean {
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");
  const source = originHeader ?? refererHeader;
  if (!source) return true;
  try {
    const sourceHost = new URL(source).host;
    const targetHost = new URL(req.url).host;
    return sourceHost === targetHost;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  try {
    const { system, user } = buildPrompt(parsed.data);
    const text = await callGemini(system, user);
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "ai failed" }, { status: 500 });
  }
}
