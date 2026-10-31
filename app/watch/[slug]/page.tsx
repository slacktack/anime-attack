import type { Metadata } from "next";
import { WatchView } from "@/components/screens/WatchView";

function formatSlugForTitle(slug: string): string {
  return slug
    .replace(/-episode-?\d+.*$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = formatSlugForTitle(slug) || "Watch";
  return {
    title,
    description: `Watch ${title} in sub or dub with adaptive quality streaming.`,
  };
}

type WatchSearchParams = {
  mal?: string;
  ep?: string;
  audio?: string;
};

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<WatchSearchParams>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const malId = Number(query.mal) > 0 ? Number(query.mal) : undefined;
  const episode = Number(query.ep) > 0 ? Number(query.ep) : undefined;
  const initialAudio = query.audio === "dub" || query.audio === "sub" ? query.audio : undefined;

  return (
    <main className="aa-gutter pb-12 pt-0 sm:pt-5 lg:pt-6">
      <WatchView slug={slug} malId={malId} episode={episode} initialAudio={initialAudio} />
    </main>
  );
}
