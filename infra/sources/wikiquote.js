import { parse, NodeType } from "node-html-parser";
import http from "infra/sources/http.js";

const QUOTES_PER_READING = 6;
const EXCLUDED_SECTIONS =
  /^(sobre|citações sobre|ditos sobre|ver também|referências|ligações externas|fontes|bibliografia|erroneamente|disputad|mal atribuíd|quotes about|about |see also|external links|references|sources|bibliography|disputed|misattributed)/i;

const client = http.createClient({ minIntervalInMilliseconds: 1200 });

function parsePage(entry) {
  const match = /^(en):(.+)$/.exec(entry);
  return match
    ? { lang: match[1], page: match[2] }
    : { lang: "pt", page: entry };
}

function parseExternalId(externalId) {
  return parsePage(externalId.replace(/^wikiquote:/, ""));
}

function getPageUrl({ lang, page }) {
  return `https://${lang}.wikiquote.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`;
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function discover(authorConfig) {
  return (authorConfig.quote_pages ?? []).map((entry) => ({
    external_id: `wikiquote:${entry}`,
    title: `Pensamentos de ${authorConfig.short_name ?? authorConfig.name}`,
    collection: "Wikiquote",
    url: getPageUrl(parsePage(entry)),
  }));
}

async function fetchPage(externalId, { interactive = false } = {}) {
  const { lang, page } = parseExternalId(externalId);
  const params = new URLSearchParams({
    action: "parse",
    page,
    prop: "text",
    redirects: "1",
    format: "json",
    formatversion: "2",
  });

  const data = await client.getJson(
    `https://${lang}.wikiquote.org/w/api.php?${params}`,
    {
      timeoutInMilliseconds: interactive ? 10000 : 30000,
      interactive,
    },
  );

  return data.parse?.text ?? null;
}

function getHeadingText(node) {
  const tag = node.rawTagName?.toLowerCase();
  if (tag === "h2" || tag === "h3") {
    return { level: tag, text: cleanText(node.text) };
  }

  if (node.classList?.contains("mw-heading")) {
    const heading = node.querySelector("h2, h3");
    if (heading) {
      return {
        level: heading.rawTagName.toLowerCase(),
        text: cleanText(heading.text),
      };
    }
  }

  return null;
}

function extractQuotes(pageHtml) {
  const root = parse(pageHtml);
  const container = root.querySelector(".mw-parser-output") || root;
  container
    .querySelectorAll("sup, style, .mw-editsection")
    .forEach((node) => node.remove());

  const quotes = [];
  let sectionText = "";
  let subsectionText = "";

  for (const node of container.childNodes) {
    if (node.nodeType !== NodeType.ELEMENT_NODE) continue;

    const heading = getHeadingText(node);
    if (heading) {
      if (heading.level === "h2") {
        sectionText = heading.text;
        subsectionText = "";
      } else {
        subsectionText = heading.text;
      }
      continue;
    }

    if (node.rawTagName.toLowerCase() !== "ul") continue;
    if (
      EXCLUDED_SECTIONS.test(sectionText) ||
      EXCLUDED_SECTIONS.test(subsectionText)
    ) {
      continue;
    }

    for (const item of node.childNodes) {
      if (item.rawTagName?.toLowerCase() !== "li") continue;

      const nested = item.querySelector("ul, dl");
      const source = nested ? cleanText(nested.text) : null;
      nested?.remove();

      const text = cleanText(item.text);
      if (text.length < 30 || text.length > 700) continue;

      const sectionSource = /verificad|atribu|citaç/i.test(subsectionText)
        ? null
        : subsectionText;
      quotes.push({ text, source: source || sectionSource || null });
    }
  }

  return quotes;
}

function groupQuotes(quotes) {
  const groups = [];

  for (let index = 0; index < quotes.length; index += QUOTES_PER_READING) {
    const html = quotes
      .slice(index, index + QUOTES_PER_READING)
      .map(
        (quote) =>
          `<blockquote><p>${escapeHtml(quote.text)}</p>${
            quote.source ? `<p><em>— ${escapeHtml(quote.source)}</em></p>` : ""
          }</blockquote>`,
      )
      .join("");
    groups.push(html);
  }

  return groups;
}

const wikiquote = {
  discover,
  fetchPage,
  extractQuotes,
  parseExternalId,
  groupQuotes,
};

export default wikiquote;
