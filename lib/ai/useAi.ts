"use client";
import { useState } from "react";
import type { AiTask } from "@/lib/ai/prompts";

interface AiArgs { task: AiTask; animeTitle: string; ceiling: number; question?: string; characterName?: string; context?: string; }

export function useAi() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function ask(args: AiArgs) {
    setLoading(true); setError(false); setText("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { text: string };
      setText(json.text);
    } catch { setError(true); } finally { setLoading(false); }
  }
  return { text, loading, error, ask };
}
