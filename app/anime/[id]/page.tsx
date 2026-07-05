import { AnimeDetail } from "@/components/screens/AnimeDetail";

export default async function AnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main><AnimeDetail id={Number(id)} /></main>;
}
