import useSWR from "swr";
import { getThemeName } from "utils/readings.js";

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error("Failed to load reading profile");
  }
  return response.json();
}

function Chips({ items, getLabel, variant }) {
  if (items.length === 0) return null;

  const className =
    variant === "negative"
      ? "border border-border text-muted-foreground line-through"
      : "bg-secondary text-secondary-foreground";

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.key}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
        >
          {getLabel(item)}
        </span>
      ))}
    </div>
  );
}

export default function ReadingProfile() {
  const { data } = useSWR("/api/v1/readings/profile", fetchAPI);

  if (!data) return null;

  if (data.signals < 3) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Leia, reaja e favorite alguns textos para o Lumen aprender seus gostos.
      </section>
    );
  }

  const themeLabel = (item) => getThemeName(item.key);
  const authorLabel = (item) => item.label;
  const kindLabel = (item) => item.key;
  const hasDislikes =
    data.dislikes.themes.length +
      data.dislikes.authors.length +
      data.dislikes.kinds.length >
    0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-medium">O que o Lumen aprendeu sobre você</h2>
        <p className="text-xs text-muted-foreground">
          Baseado em {data.signals} leitura(s), reações e favoritos · confiança{" "}
          {Math.round(data.confidence * 100)}%
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Chips items={data.likes.themes} getLabel={themeLabel} />
        <Chips items={data.likes.authors} getLabel={authorLabel} />
        <Chips items={data.likes.kinds} getLabel={kindLabel} />
      </div>

      {hasDislikes && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Aparece menos</p>
          <Chips
            items={data.dislikes.themes}
            getLabel={themeLabel}
            variant="negative"
          />
          <Chips
            items={data.dislikes.authors}
            getLabel={authorLabel}
            variant="negative"
          />
          <Chips
            items={data.dislikes.kinds}
            getLabel={kindLabel}
            variant="negative"
          />
        </div>
      )}
    </section>
  );
}
