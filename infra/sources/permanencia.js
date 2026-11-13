import { parse } from "node-html-parser";
import http from "infra/sources/http.js";

const ORIGIN = "https://permanencia.org.br";

const client = http.createClient({ minIntervalInMilliseconds: 1000 });

async function fetchPage(url) {
  return await client.getHtml(url, { timeoutInMilliseconds: 30000 });
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
  const looksLikeName =
    firstText.length > 3 &&
    firstText.length < 80 &&
    firstText.split(" ").length <= 9 &&
    !/["“”«»]/.test(firstText) &&
    !/[.?!:;]$/.test(firstText) &&
    !/^(a|ao|aos|à|às|para)\s/i.test(firstText);
  const isByline =
    looksLikeName &&
    (firstParagraph.classList.contains("rteright") ||
      (emphasis && cleanText(emphasis.text) === firstText));

  const author = isByline ? firstText : null;
  if (isByline) firstParagraph.remove();

  return { title, author, html: container.innerHTML };
}

const permanencia = {
  fetchPage,
  discover,
  extractArticle,
};

export default permanencia;
