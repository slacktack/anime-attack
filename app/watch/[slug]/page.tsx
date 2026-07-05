import type { Metadata } from "next";
import { WatchView } from "@/components/screens/WatchView";

function formatSlugForTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = formatSlugForTitle(slug);
  return {
    title: `${title} · Anime Companion`,
    description: `Watch ${title} online — AniwatchTV powered stream.`,
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="px-4 pt-6 sm:pt-8">
      <WatchView slug={slug} />
    </main>
  );
}
