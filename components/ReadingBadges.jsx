import { AREA_LABELS, TONE_LABELS, getThemeName } from "utils/readings.js";

function Badge({ children, variant = "secondary" }) {
  const className =
    variant === "outline"
      ? "border border-border text-muted-foreground"
      : "bg-secondary text-secondary-foreground";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function ReadingMetaBadges({ reading }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {reading.kind && <Badge>{reading.kind}</Badge>}
      {reading.area && (
        <Badge>{AREA_LABELS[reading.area] ?? reading.area}</Badge>
      )}
      {reading.tone && (
        <Badge>{TONE_LABELS[reading.tone] ?? reading.tone}</Badge>
      )}
      {reading.reading_minutes && <Badge>~{reading.reading_minutes} min</Badge>}
      {reading.part_total && (
        <Badge>
          Parte {reading.part_number} de {reading.part_total}
        </Badge>
      )}
    </div>
  );
}

export function ThemeBadges({ themes = [] }) {
  if (themes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {themes.map((theme) => (
        <Badge key={theme} variant="outline">
          {getThemeName(theme)}
        </Badge>
      ))}
    </div>
  );
}
