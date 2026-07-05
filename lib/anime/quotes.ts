type Rec = Record<string, any>;

export interface AnimeQuote {
  anime: string;
  character: string;
  quote: string;
}

export async function getRandomQuote(): Promise<AnimeQuote | null> {
  try {
    const res = await fetch("https://animechan.io/api/v1/random", {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Rec };
    const data = json.data;
    if (!data) return null;
    return {
      anime: data.anime?.name,
      character: data.character?.name,
      quote: data.content,
    };
  } catch {
    return null;
  }
}
