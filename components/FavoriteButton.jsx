import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "src/components/ui/button";
import readingService from "services/readingService.js";

export default function FavoriteButton({
  readingId,
  isFavorite,
  onChange,
  showLabel = false,
}) {
  const [favorite, setFavorite] = useState(isFavorite);
  const [isSaving, setIsSaving] = useState(false);

  async function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const nextValue = !favorite;
    setFavorite(nextValue);
    setIsSaving(true);
    try {
      const response = await readingService.setFavorite(readingId, nextValue);
      if (!response.ok) {
        setFavorite(!nextValue);
        return;
      }
      onChange?.(nextValue);
    } finally {
      setIsSaving(false);
    }
  }

  const icon = (
    <Star className={favorite ? "fill-amber-400 text-amber-500" : undefined} />
  );

  if (showLabel) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isSaving}
        aria-pressed={favorite}
      >
        {icon} {favorite ? "Favorito" : "Favoritar"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={isSaving}
      aria-label={
        favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
      }
      aria-pressed={favorite}
    >
      {icon}
    </Button>
  );
}
