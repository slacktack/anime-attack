"use client";
import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/storage/store";
import type { AnimeSummary } from "@/lib/anime/types";

export function FavoriteButton({
  anime,
  iconOnly = false,
}: {
  anime: AnimeSummary;
  iconOnly?: boolean;
}) {
  const [fav, setFav] = useState(false);
  useEffect(() => setFav(isFavorite(anime.id)), [anime.id]);
  const Icon = fav ? Check : Plus;

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={() => setFav(toggleFavorite(anime))}
        aria-pressed={fav}
        aria-label={fav ? "Remove from My list" : "Add to My list"}
        title={fav ? "In My list" : "Add to My list"}
        className="aa-iconbtn"
      >
        <Icon size={22} strokeWidth={2.4} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setFav(toggleFavorite(anime))}
      aria-pressed={fav}
      className="nb-btn"
    >
      <Icon size={17} strokeWidth={2.4} />
      {fav ? "In My list" : "My list"}
    </button>
  );
}
