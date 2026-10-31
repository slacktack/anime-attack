import type { Metadata } from "next";
import { MangaBrowser } from "@/components/manga/MangaBrowser";

export const metadata: Metadata = {
  title: "Manga",
  description: "Search and read manga online with no ads or redirects.",
};

export default function MangaPage() {
  return (
    <main className="aa-gutter pb-12 pt-4 lg:pt-8">
      <MangaBrowser />
    </main>
  );
}
