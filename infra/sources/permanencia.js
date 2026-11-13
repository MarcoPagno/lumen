import { parse } from "node-html-parser";
import http from "infra/sources/http.js";

const ORIGIN = "https://permanencia.org.br";

const client = http.createClient({ minIntervalInMilliseconds: 1000 });

async function fetchPage(url) {
  return await client.getHtml(url, { timeoutInMilliseconds: 30000 });
}

async function discover(authorConfig) {
  const candidates = new Map();

  for (const listUrl of authorConfig.lists ?? []) {
    const html = await fetchPage(listUrl);

    for (const link of parse(html).querySelectorAll("a")) {
      const href = link.getAttribute("href");
      if (!href || !new RegExp(authorConfig.article_pattern).test(href)) {
        continue;
      }

      const url = new URL(href, ORIGIN).toString();
      const title = link.text.replace(/\s+/g, " ").trim();
      if (title && !candidates.has(url)) {
        candidates.set(url, {
          external_id: url,
          title,
          collection: null,
          url,
        });
      }
    }
  }

  return [...candidates.values()];
}

function extractArticle(pageHtml) {
  const root = parse(pageHtml);
  const container = root.querySelector("div.col-lg-8") || root;
  const heading = container.querySelector("h2");
  const title = heading?.text.replace(/\s+/g, " ").trim() || null;
  heading?.remove();

  return { title, html: container.innerHTML };
}

const permanencia = {
  fetchPage,
  discover,
  extractArticle,
};

export default permanencia;
