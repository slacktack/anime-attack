export type AiTask = "summary" | "catchup" | "chat" | "character" | "recommend";

interface PromptInput {
  task: AiTask;
  animeTitle: string;
  ceiling: number;
  context?: string;
  question?: string;
  characterName?: string;
}

function spoilerRule(ceiling: number): string {
  if (ceiling <= 0) {
    return "The viewer has watched NO episodes yet. Only give setup/premise-level, entirely spoiler-free information. Do not reveal any plot developments.";
  }
  return `The viewer has watched up to and including episode ${ceiling}. Do not reveal, hint at, or reference ANY event, twist, death, power-up, or character development that occurs after episode ${ceiling}. If answering fully would require later content, say it is beyond their current progress and offer a spoiler-free alternative.`;
}

export function buildPrompt(input: PromptInput): { system: string; user: string } {
  const { task, animeTitle, ceiling, context, question, characterName } = input;
  const system = [
    `You are an expert, spoiler-aware anime companion for "${animeTitle}".`,
    spoilerRule(ceiling),
    "Be concise, warm, and specific. Use plain language. Never invent facts.",
    context ? `Reference context:\n${context}` : "",
  ].filter(Boolean).join("\n\n");

  const user = ((): string => {
    switch (task) {
      case "summary": return `Give a 1-line hook, then a short spoiler-safe summary of "${animeTitle}".`;
      case "catchup": return `Recap the story of "${animeTitle}" so far, so I can jump back in.`;
      case "chat": return question ?? "Tell me something interesting.";
      case "character": return `Explain the character ${characterName ?? "(unknown)"} from "${animeTitle}": who they are, their role, powers, and key relationships.`;
      case "recommend": return `Recommend 5 anime I'd like based on "${animeTitle}", each with a one-line reason.`;
    }
  })();

  return { system, user };
}
