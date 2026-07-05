import { NextResponse } from "next/server";

const FALLBACK_QUOTES = [
  { anime: "Naruto", character: "Naruto Uzumaki", quote: "I'm not going to run away. I never go back on my word. That's my nindo, my ninja way." },
  { anime: "One Piece", character: "Monkey D. Luffy", quote: "I don't want to conquer anything. I just think the guy with the most freedom in this whole ocean is the Pirate King." },
  { anime: "Attack on Titan", character: "Eren Yeager", quote: "If you win, you live. If you lose, you die. If you don't fight, you can't win." },
  { anime: "Death Note", character: "L", quote: "If you can't win the game, if you can't solve the puzzle, you're just a loser." },
  { anime: "Fullmetal Alchemist", character: "Edward Elric", quote: "A lesson without pain is meaningless. That's because no one can gain without sacrificing something." },
  { anime: "Cowboy Bebop", character: "Spike Spiegel", quote: "Whatever happens, happens." },
  { anime: "Dragon Ball Z", character: "Goku", quote: "Power comes in response to a need, not a desire. You have to create that need." },
  { anime: "Steins;Gate", character: "Okabe Rintarou", quote: "No one knows what the future holds. That's why its potential is infinite." },
  { anime: "Hunter x Hunter", character: "Killua Zoldyck", quote: "If I ignore a friend I have the ability to help, wouldn't I be betraying him?" },
  { anime: "Bleach", character: "Ichigo Kurosaki", quote: "If you give me wings, I will soar for you even if this whole land sinks down to the water." },
];

function randomFallback() {
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch("https://animechan.io/api/v1/random", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.data) {
        return NextResponse.json(
          {
            anime: data.data.anime?.name ?? "Unknown",
            character: data.data.character?.name ?? "Unknown",
            quote: data.data.content ?? "...",
          },
          { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
        );
      }
    }
  } catch {
    // API unavailable — fall through to fallback
  }

  return NextResponse.json(randomFallback(), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
  });
}
