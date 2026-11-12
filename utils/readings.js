import themes from "models/reading-themes.json";

export const AREA_LABELS = {
  teologia: "Teologia",
  filosofia: "Filosofia",
  literatura: "Literatura",
  historia: "História",
};

export const TONE_LABELS = {
  leve: "Leve",
  inspirador: "Inspirador",
  denso: "Denso",
};

export const SOURCE_LABELS = {
  wikisource: "Wikisource",
  olavo: "olavodecarvalho.org",
};

export const THEMES = themes.map(({ slug, name, area }) => ({
  slug,
  name,
  area,
}));

export function getThemeName(slug) {
  return themes.find((theme) => theme.slug === slug)?.name ?? slug;
}

export function getAuthorYears(author) {
  if (!author?.birth_year) return null;
  return `${author.birth_year}–${author.death_year ?? ""}`;
}
