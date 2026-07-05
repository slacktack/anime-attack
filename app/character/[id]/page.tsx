import { CharacterDetail } from "@/components/screens/CharacterDetail";

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main><CharacterDetail id={Number(id)} /></main>;
}
