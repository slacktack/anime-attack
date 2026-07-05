type Rec = Record<string, any>;

export interface AnimeQuote {
  anime: string;
  character: string;
  quote: string;
}

const QUOTE_API = "/api/proxy/quotes";

export async function getRandomQuote(): Promise<AnimeQuote | null> {
  try {
    const res = await fetch(QUOTE_API);
    if (!res.ok) return null;
    const json = (await res.json()) as Rec;
    const anime = json.anime ?? json.data?.anime?.name ?? "Unknown";
    const character = json.character ?? json.data?.character?.name ?? "Unknown";
    const quote = json.quote ?? json.data?.content ?? "...";
    return { anime, character, quote };
  } catch {
    return null;
  }
}
