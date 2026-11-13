import { parse, NodeType } from "node-html-parser";
import http from "infra/sources/http.js";
import readingText from "models/reading-text.js";

const ORIGIN = "https://www.vatican.va";
const CATECHISM_INDEX_URL = `${ORIGIN}/archive/cathechism_po/index_new/prima-pagina-cic_po.html`;
const CATECHISM_TITLE = "Catecismo da Igreja Católica";
const UNIT_MIN_WORDS = 150;
const UNIT_MAX_WORDS = 2400;

const KINDS = [
  [/_enc_|\/encyclicals\//, "encíclica"],
  [/apost_exhortations|_exh_/, "exortação apostólica"],
  [/apost_letters|_apl_/, "carta apostólica"],
  [/apost_constitutions|_apc_/, "constituição apostólica"],
  [/vat-ii_const/, "constituição conciliar"],
  [/vat-ii_decree/, "decreto conciliar"],
  [/vat-ii_decl/, "declaração conciliar"],
  [/cathechism/, "catecismo"],
];

const client = http.createClient({ minIntervalInMilliseconds: 800 });

function isCatechismUrl(url) {
  return url.includes("/cathechism_po/");
}

function getKind(url) {
  return KINDS.find(([pattern]) => pattern.test(url))?.[1] ?? "documento";
}

function toAbsoluteUrl(href, baseUrl) {
  return new URL(href, baseUrl).toString().split("#")[0];
}

function cleanTitle(title) {
  return title.replace(/\s+/g, " ").trim();
}

function extractYear(text) {
  const match = text.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

async function fetchPage(url) {
  return await client.getHtml(url, { timeoutInMilliseconds: 30000 });
}

async function discover(authorConfig) {
  const candidates = [];

  if (authorConfig.catechism) {
    const indexHtml = await fetchPage(CATECHISM_INDEX_URL);
    const links = parse(indexHtml)
      .querySelectorAll("a")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href && /^(p\d|prologo)/.test(href))
      .map((href) => toAbsoluteUrl(href, CATECHISM_INDEX_URL));

    for (const url of new Set(links)) {
      candidates.push({
        external_id: url,
        title: CATECHISM_TITLE,
        collection: CATECHISM_TITLE,
        url,
      });
    }
  }

  for (const indexUrl of authorConfig.indexes ?? []) {
    const indexHtml = await fetchPage(indexUrl);
    const documentsPath = new URL(indexUrl).pathname.replace(
      /\.index\.html$/,
      "/documents/",
    );

    for (const link of parse(indexHtml).querySelectorAll("a")) {
      const href = link.getAttribute("href");
      if (!href?.startsWith(documentsPath)) continue;

      const url = toAbsoluteUrl(href, ORIGIN);
      const title = cleanTitle(link.text);
      if (!title || candidates.some((item) => item.external_id === url)) {
        continue;
      }

      candidates.push({
        external_id: url,
        title,
        collection: null,
        url,
        year: extractYear(title) ?? extractYear(href),
      });
    }
  }

  for (const page of authorConfig.documents ?? []) {
    candidates.push({
      external_id: page.url,
      title: page.title,
      collection: null,
      url: page.url,
      year: page.year ?? null,
    });
  }

  return candidates;
}

function extractDocumentHtml(pageHtml) {
  const root = parse(pageHtml);
  root
    .querySelectorAll(".translation-field, .translation")
    .forEach((node) => node.remove());

  const container =
    root.querySelector(".documento .testo") ||
    root.querySelector(".documento") ||
    root.querySelector("#corpo") ||
    root.querySelector("body") ||
    root;

  let html = container.innerHTML.replace(
    /<\/?(table|tbody|thead|tr|td|th|font|center|div|span)\b[^>]*>/gi,
    "",
  );

  const halfway = html.length / 2;
  const notesStart = [...html.matchAll(/<hr\b[^>]*>/gi)].find(
    (match) => match.index > halfway,
  );
  if (notesStart) {
    html = html.slice(0, notesStart.index);
  }

  const content = parse(html);
  content
    .querySelectorAll("p")
    .filter((paragraph) =>
      /^\[?\s*([A-Z]{2}(_[A-Z]{2})?\s*-\s*)+[A-Z]{2}(_[A-Z]{2})?\s*\]?$/.test(
        paragraph.text.trim(),
      ),
    )
    .forEach((paragraph) => paragraph.remove());

  return content.toString();
}

function toSentenceCase(text) {
  if (text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function isCatechismHeading(node, text) {
  if (node.rawTagName?.toLowerCase() !== "p") return false;
  if (/^\d+\./.test(text) || text.length >= 160) return false;

  const bold = node.querySelector("b");
  return (
    node.getAttribute("align") === "center" ||
    /^[IVX]+\.\s/.test(text) ||
    Boolean(bold && bold.text.trim() === text)
  );
}

function extractCatechismUnits(pageHtml) {
  const content = parse(extractDocumentHtml(pageHtml));
  const blocks = content.childNodes.filter(
    (node) => node.nodeType === NodeType.ELEMENT_NODE,
  );

  const rawUnits = [];
  let context = null;
  let pendingLabel = null;
  let headings = [];
  let body = [];

  for (const block of blocks) {
    const text = block.text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (isCatechismHeading(block, text)) {
      if (body.length > 0) {
        rawUnits.push({ context, headings, body });
        headings = [];
        body = [];
      }
      if (/^(ARTIGO|PARÁGRAFO)\b/i.test(text)) {
        pendingLabel = text;
      } else if (pendingLabel) {
        context = `${toSentenceCase(pendingLabel)} — ${toSentenceCase(text)}`;
        pendingLabel = null;
      }
      headings.push(text);
      continue;
    }

    body.push(block.toString());
  }

  if (body.length > 0) {
    rawUnits.push({ context, headings, body });
  }

  const merged = [];
  for (const unit of rawUnits) {
    const words = readingText.countWords(
      readingText.toPlainText(unit.body.join("")),
    );
    const previous = merged[merged.length - 1];
    const isSummary = /^resumindo/i.test(unit.headings[0] ?? "");

    if (previous && (isSummary || previous.words < UNIT_MIN_WORDS)) {
      previous.body.push(
        ...unit.headings.map((heading) => `<h4>${heading}</h4>`),
        ...unit.body,
      );
      previous.words += words;
      if (!isSummary) {
        previous.headings.push(...unit.headings);
      }
      continue;
    }

    merged.push({ ...unit, body: [...unit.body], words });
  }

  return merged.flatMap((unit) => {
    const title = buildUnitTitle(unit);
    const html = unit.body.join("");
    const chunks =
      unit.words > UNIT_MAX_WORDS ? readingText.splitIntoParts(html) : [html];

    return chunks.map((chunk, index) => ({
      title: index === 0 ? title : `${title} (continuação)`,
      collection: unit.context
        ? `${CATECHISM_TITLE} · ${unit.context}`
        : CATECHISM_TITLE,
      html: chunk,
    }));
  });
}

function buildUnitTitle(unit) {
  const numbers = unit.body
    .map((block) => /^<p[^>]*>\s*(?:<b>)?\s*(\d+)\./.exec(block)?.[1])
    .filter(Boolean)
    .map(Number);

  const heading = toSentenceCase(
    unit.headings
      .filter((text) => !/^(ARTIGO|PARÁGRAFO)\b/i.test(text))
      .at(-1) ??
      unit.headings.at(-1) ??
      "Introdução",
  );

  if (numbers.length === 0) return heading;

  const first = Math.min(...numbers);
  const last = Math.max(...numbers);
  const range = first === last ? `§ ${first}` : `§§ ${first}–${last}`;
  return `${heading} (${range})`;
}

const vatican = {
  CATECHISM_TITLE,
  isCatechismUrl,
  getKind,
  fetchPage,
  discover,
  extractDocumentHtml,
  extractCatechismUnits,
};

export default vatican;
