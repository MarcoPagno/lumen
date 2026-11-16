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

const LANGUAGES_STORAGE_KEY = "lumen:readingLanguages";

export const LANGUAGE_LABELS = {
  pt: "Português",
  en: "Inglês",
};

export function getReadingLanguages() {
  try {
    return localStorage.getItem(LANGUAGES_STORAGE_KEY) || "pt,en";
  } catch {
    return "pt,en";
  }
}

export function setIncludeEnglish(includeEnglish) {
  try {
    localStorage.setItem(
      LANGUAGES_STORAGE_KEY,
      includeEnglish ? "pt,en" : "pt",
    );
  } catch {
    return;
  }
}

export function getNextReadingKey() {
  const languages =
    typeof window === "undefined" ? "pt,en" : getReadingLanguages();
  return `/api/v1/readings/next?languages=${languages}`;
}

export const SOURCE_LABELS = {
  wikisource: "Wikisource",
  olavo: "olavodecarvalho.org",
  vatican: "vatican.va",
  permanencia: "Permanência",
  link: "Página original",
  blogger: "Blog do autor",
  wikiquote: "Wikiquote",
  escritas: "Escritas.org",
};

export const THEMES = themes.map(({ slug, name, area }) => ({
  slug,
  name,
  area,
}));

export function getThemeName(slug) {
  return themes.find((theme) => theme.slug === slug)?.name ?? slug;
}

function formatYear(year) {
  if (year == null) return "";
  return year < 0 ? `${Math.abs(year)} a.C.` : String(year);
}

export function getAuthorYears(author) {
  if (author?.birth_year == null) return null;
  return `${formatYear(author.birth_year)}–${formatYear(author.death_year)}`;
}
