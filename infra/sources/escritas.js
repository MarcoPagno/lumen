import { parse } from "node-html-parser";
import http from "infra/sources/http.js";

const ORIGIN = "https://www.escritas.org";
const MAX_PAGES = 120;

const client = http.createClient({ minIntervalInMilliseconds: 1000 });

async function fetchPage(url) {
  return await client.getHtml(url, { timeoutInMilliseconds: 30000 });
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function getLastPage(root, authorPath) {
  const pages = root
    .querySelectorAll("a")
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith(`${authorPath}?page=`))
    .map((href) => Number(/page=(\d+)/.exec(href)?.[1]))
    .filter(Boolean);

  return Math.min(Math.max(1, ...pages), MAX_PAGES);
}

async function discover(authorConfig) {
  const authorPath = `/pt/${authorConfig.escritas_slug}`;
  const candidates = new Map();
  let lastPage = 1;

  for (let page = 1; page <= lastPage; page++) {
    const html = await fetchPage(`${ORIGIN}${authorPath}?page=${page}`);
    const root = parse(html);
    if (page === 1) lastPage = getLastPage(root, authorPath);

    for (const link of root.querySelectorAll('a[href^="/pt/t/"]')) {
      const url = new URL(link.getAttribute("href"), ORIGIN).toString();
      const linkText = cleanText(link.text);
      const title = /^ler poema/i.test(linkText) ? "" : linkText;
      const existing = candidates.get(url);

      if (!existing) {
        candidates.set(url, {
          external_id: url,
          title: title || null,
          collection: null,
          url,
        });
      } else if (!existing.title && title) {
        existing.title = title;
      }
    }
  }

  return [...candidates.values()].map((candidate) => ({
    ...candidate,
    title: candidate.title || "Poema",
  }));
}

function extractPoem(pageHtml, escritasSlug) {
  const root = parse(pageHtml);
  const body = root.querySelector(".poem-body");
  const title =
    cleanText(
      root.querySelector(".poem-display-title")?.text ??
        root.querySelector("h1")?.text ??
        "",
    ) || null;

  const authorPath = `/pt/${escritasSlug}`;
  const isFromAuthor = root
    .querySelectorAll("header a")
    .some((link) => link.getAttribute("href") === authorPath);

  return { title, isFromAuthor, html: body?.innerHTML ?? "" };
}

const escritas = {
  fetchPage,
  discover,
  extractPoem,
};

export default escritas;
