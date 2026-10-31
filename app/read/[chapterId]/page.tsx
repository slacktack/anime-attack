import type { Metadata } from "next";
import { MangaReader } from "@/components/manga/MangaReader";

export const metadata: Metadata = {
  title: "Reader",
};

export default async function ReadPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  return (
    <main className="px-4 pt-4">
      <MangaReader chapterId={chapterId} />
    </main>
  );
}
