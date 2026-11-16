import { parse } from "node-html-parser";
import http from "infra/sources/http.js";

const ORIGIN = "https://permanencia.org.br";

const client = http.createClient({ minIntervalInMilliseconds: 1000 });

async function fetchPage(url, { interactive = false } = {}) {
  return await client.getHtml(url, {
    timeoutInMilliseconds: interactive ? 10000 : 30000,
    interactive,
  });
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function discover(authorConfig) {
  const candidates = new Map();
  const articlePattern = new RegExp(authorConfig.article_pattern);

  for (const list of authorConfig.lists ?? []) {
    const html = await fetchPage(list.url);
    let subcategory = null;

    for (const node of parse(html).querySelectorAll(
      "h2.subcategoria-titulo, a",
    )) {
      if (node.rawTagName.toLowerCase() === "h2") {
        subcategory = cleanText(node.text);
        continue;
      }

      const href = node.getAttribute("href");
      if (!href || !articlePattern.test(href)) continue;

      const url = new URL(href, ORIGIN).toString();
      const title = cleanText(node.text);
      if (!title || candidates.has(url)) continue;

      candidates.set(url, {
        external_id: url,
        title,
        collection: buildCollection(list.name, subcategory, authorConfig),
        url,
      });
    }
  }

  return [...candidates.values()];
}

function buildCollection(listName, subcategory, authorConfig) {
  if (listName === authorConfig.name) return null;
  if (!subcategory || subcategory === listName) return listName;
  return `${listName} · ${subcategory}`;
}

const NAME_CONNECTORS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "d'",
  "del",
  "di",
  "du",
  "la",
  "le",
  "van",
  "von",
]);

const NOT_NAME_WORDS = new Set([
  "advento",
  "anexo",
  "apendice",
  "ascensao",
  "assuncao",
  "capitulo",
  "carta",
  "comentario",
  "conclusao",
  "continua",
  "continuacao",
  "domingo",
  "editorial",
  "entrevista",
  "epistola",
  "evangelho",
  "feira",
  "festa",
  "homilia",
  "introducao",
  "leia",
  "licao",
  "liturgia",
  "missa",
  "natal",
  "nota",
  "oracao",
  "parte",
  "pascoa",
  "pentecostes",
  "permanencia",
  "prefacio",
  "quaresma",
  "redacao",
  "relendo",
  "revista",
  "sabado",
  "segunda",
  "semana",
  "sexta",
  "terca",
  "quarta",
  "quinta",
  "sermao",
  "si",
  "sim",
  "no",
  "nao",
  "sobre",
  "tempo",
  "textos",
]);

function normalizeWord(word) {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z']/g, "");
}

function isPlausibleAuthorName(rawName) {
  const name = cleanText(rawName ?? "");
  const words = name.split(" ");

  if (name.length < 4 || name.length > 70) return false;
  if (words.length < 2 || words.length > 9) return false;
  if (/\d/.test(name) || /["“”«»]/.test(name)) return false;
  if (!/^\p{Lu}/u.test(name)) return false;
  if (name === name.toUpperCase()) return false;

  return words.every((word) => {
    const normalized = normalizeWord(word);
    const parts = word.split("-").map(normalizeWord);
    if (parts.some((part) => NOT_NAME_WORDS.has(part))) return false;
    if (NAME_CONNECTORS.has(normalized)) return true;
    return /^[\p{Lu}(]/u.test(word) || /^[A-Z]+$/.test(word);
  });
}

function extractArticle(pageHtml) {
  const root = parse(pageHtml);
  const container =
    root
      .querySelectorAll("div.col-lg-8, div.col-lg-12")
      .find((element) => element.querySelector("h2")) || root;

  const heading = container.querySelector("h2");
  const title = heading ? cleanText(heading.text) || null : null;
  heading?.remove();

  const firstParagraph = container.querySelector("p");
  const firstText = firstParagraph ? cleanText(firstParagraph.text) : "";
  const emphasis = firstParagraph?.querySelector("em, i");
  const looksLikeByline =
    firstText.length > 3 &&
    firstText.length < 80 &&
    firstText.split(" ").length <= 9 &&
    !/["“”«»]/.test(firstText) &&
    !/[.?!:;]$/.test(firstText) &&
    !/^(a|ao|aos|à|às|para)\s/i.test(firstText);
  const isByline =
    looksLikeByline &&
    (firstParagraph.classList.contains("rteright") ||
      (emphasis && cleanText(emphasis.text) === firstText));

  const author =
    isByline && isPlausibleAuthorName(firstText) ? firstText : null;
  if (isByline) firstParagraph.remove();

  return { title, author, html: container.innerHTML };
}

const permanencia = {
  fetchPage,
  discover,
  extractArticle,
  isPlausibleAuthorName,
};

export default permanencia;
