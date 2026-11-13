import { parse } from "node-html-parser";
import { ValidationError } from "infra/errors.js";
import http from "infra/sources/http.js";

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "iframe",
  ".comments",
  "#comments",
];

const client = http.createClient({ retries: 1 });

function validateUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    url = null;
  }

  const isPrivateHost =
    !url ||
    /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(
      url.hostname,
    ) ||
    !url.hostname.includes(".");

  if (!url || !["http:", "https:"].includes(url.protocol) || isPrivateHost) {
    throw new ValidationError({
      message: "Invalid URL",
      action: "Provide a public http(s) address of the page",
    });
  }

  return url.toString();
}

async function fetchPage(url) {
  return await client.getHtml(validateUrl(url), {
    timeoutInMilliseconds: 15000,
  });
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMain(pageHtml) {
  const root = parse(pageHtml);

  const title =
    root
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content")
      ?.trim() ||
    root.querySelector("h1")?.text.trim() ||
    root.querySelector("title")?.text.trim() ||
    null;

  const siteName = root
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute("content")
    ?.trim();
  const cleanTitle =
    title && siteName
      ? title.replace(
          new RegExp(`\\s*[-|–—]\\s*${escapeRegExp(siteName)}$`),
          "",
        )
      : title;

  const author =
    root
      .querySelector('meta[name="author"]')
      ?.getAttribute("content")
      ?.trim() || null;

  for (const selector of NOISE_SELECTORS) {
    root.querySelectorAll(selector).forEach((node) => node.remove());
  }

  const candidates = root.querySelectorAll("article, main, section, div");
  let best = root.querySelector("body") || root;
  let bestScore = 0;

  for (const element of candidates) {
    const paragraphs = element.childNodes.filter(
      (node) => node.rawTagName?.toLowerCase() === "p",
    );
    const score = paragraphs.reduce(
      (sum, paragraph) => sum + paragraph.text.trim().length,
      0,
    );
    if (score > bestScore) {
      best = element;
      bestScore = score;
    }
  }

  best.querySelectorAll("h1").forEach((node) => node.remove());

  return { title: cleanTitle, author, html: best.innerHTML };
}

const webpage = {
  validateUrl,
  fetchPage,
  extractMain,
};

export default webpage;
