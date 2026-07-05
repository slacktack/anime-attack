import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPrompt } from "@/lib/ai/prompts";
import { callGemini } from "@/lib/ai/gemini";

export const runtime = "nodejs";

const BodySchema = z.object({
  task: z.enum(["summary", "catchup", "chat", "character", "recommend"]),
  animeTitle: z.string().min(1),
  ceiling: z.number().int().nonnegative(),
  question: z.string().optional(),
  characterName: z.string().optional(),
  context: z.string().optional(),
});

export async function POST(req: Request) {
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
