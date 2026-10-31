import type { Metadata } from "next";
import { MangaDetailView } from "@/components/manga/MangaDetailView";

export const metadata: Metadata = {
  title: "Manga series",
};

export default async function MangaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <MangaDetailView id={id} />
    </main>
  );
}
