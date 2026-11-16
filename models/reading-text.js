import { parse, NodeType } from "node-html-parser";
import themes from "models/reading-themes.json";

const WORDS_PER_MINUTE = 200;
const MAX_READING_MINUTES = 15;
const PART_TARGET_WORDS = 1600;
const MAX_PARTS = 15;
const MIN_WORDS = 25;

const ALLOWED_TAGS = {
  p: "p",
  br: "br",
  em: "em",
  i: "em",
  strong: "strong",
  b: "strong",
  blockquote: "blockquote",
  h2: "h3",
  h3: "h3",
  h4: "h4",
  ul: "ul",
  ol: "ol",
  li: "li",
};

const BLOCK_TAGS = ["p", "blockquote", "h3", "h4", "ul", "ol"];

const CONTAINER_TAGS = ["div", "section", "article", "center", "td"];

const BLOCK_PATTERN = /<(p|blockquote|h3|h4|ul|ol)>/;

const REMOVED_SELECTORS = [
  "script",
  "style",
  "link",
  "meta",
  "table",
  "sup",
  ".ws-noexport",
  ".headertemplate",
  "#navigationHeader",
  ".mw-editsection",
  ".reference",
  ".references",
  ".mw-references-wrap",
  ".noprint",
  ".pagenum",
  ".ws-pagenum",
];

const PORTUGUESE_STOPWORDS = new Set([
  "de",
  "que",
  "o",
  "a",
  "e",
  "do",
  "da",
  "em",
  "um",
  "uma",
  "para",
  "com",
  "nao",
  "os",
  "as",
  "se",
  "no",
  "na",
  "por",
  "mais",
]);

const ENGLISH_STOPWORDS = new Set([
  "the",
  "and",
  "of",
  "to",
  "is",
  "it",
  "that",
  "you",
  "i",
  "be",
  "was",
  "for",
  "with",
  "not",
  "this",
  "but",
  "have",
  "we",
  "they",
  "he",
  "my",
  "your",
  "all",
  "in",
  "on",
  "are",
  "his",
  "her",
  "which",
  "from",
  "by",
  "at",
  "their",
  "what",
  "who",
  "an",
  "or",
  "if",
  "would",
  "were",
  "been",
  "had",
  "has",
  "its",
  "them",
  "than",
  "when",
]);

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalize(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function sanitizeHtml(html) {
  const root = parse(html);

  for (const selector of REMOVED_SELECTORS) {
    root.querySelectorAll(selector).forEach((node) => node.remove());
  }

  const output = wrapLooseContent(root.childNodes.map(renderNode).join(""));
  return output
    .replace(/<p>(\s|<br>)*<\/p>/g, "")
    .replace(/(<br>\s*){3,}/g, "<br><br>")
    .trim();

  function renderNode(node) {
    if (node.nodeType === NodeType.TEXT_NODE) {
      return escapeHtml(node.text);
    }

    if (node.nodeType !== NodeType.ELEMENT_NODE) {
      return "";
    }

    const tag = ALLOWED_TAGS[node.rawTagName?.toLowerCase()];
    const children = node.childNodes.map(renderNode).join("");

    if (!tag) {
      const isTextContainer =
        CONTAINER_TAGS.includes(node.rawTagName?.toLowerCase()) &&
        !BLOCK_PATTERN.test(children);
      return isTextContainer ? `<p>${children}</p>` : children;
    }

    if (tag === "br") {
      return "<br>";
    }

    return `<${tag}>${children}</${tag}>`;
  }
}

function wrapLooseContent(html) {
  const root = parse(html);
  const output = [];
  let loose = [];

  function flush() {
    const content = loose.join("").trim();
    if (content.replace(/<br>/g, "").trim()) {
      output.push(`<p>${content}</p>`);
    }
    loose = [];
  }

  for (const node of root.childNodes) {
    const tag = node.rawTagName?.toLowerCase();
    if (node.nodeType === NodeType.ELEMENT_NODE && BLOCK_TAGS.includes(tag)) {
      flush();
      output.push(node.toString());
    } else {
      loose.push(node.toString());
    }
  }
  flush();

  return output.join("");
}

function getLinkDensity(html) {
  const root = parse(html);
  const totalLength = root.text.trim().length;

  if (totalLength === 0) return 1;

  const linksLength = root
    .querySelectorAll("a")
    .reduce((sum, link) => sum + link.text.trim().length, 0);

  return linksLength / totalLength;
}

function getListDensity(html) {
  const root = parse(html);
  const totalLength = root.text.trim().length;
  if (totalLength === 0) return 0;

  const listLength = root
    .querySelectorAll("li")
    .reduce((sum, item) => sum + item.text.trim().length, 0);

  return listLength / totalLength;
}

function toPlainText(html) {
  return parse(html).text.replace(/\s+/g, " ").trim();
}

function countWords(text) {
  return text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
}

function getReadingMinutes(wordCount) {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

function getExcerpt(text, length = 280) {
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function detectLanguage(text) {
  const words = normalize(text)
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  if (words.length === 0) return null;

  const portuguese = words.filter((word) => PORTUGUESE_STOPWORDS.has(word));
  const english = words.filter((word) => ENGLISH_STOPWORDS.has(word));

  if (
    portuguese.length / words.length > 0.12 &&
    portuguese.length > english.length
  ) {
    return "pt";
  }

  if (
    english.length / words.length > 0.08 &&
    english.length > portuguese.length
  ) {
    return "en";
  }

  return null;
}

function isPortuguese(text) {
  return detectLanguage(text) === "pt";
}

function countTermOccurrences(normalizedText, term) {
  const isPrefix = term.endsWith("*");
  const base = escapeRegExp(normalize(isPrefix ? term.slice(0, -1) : term));
  const pattern = isPrefix
    ? `(?<![\\p{L}])${base}[\\p{L}-]*`
    : `(?<![\\p{L}])${base}(?![\\p{L}])`;

  return (normalizedText.match(new RegExp(pattern, "gu")) || []).length;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getThemeTerms(theme, language) {
  if (language === "en") return theme.terms_en;
  if (language === "any") return [...theme.terms, ...theme.terms_en];
  return theme.terms;
}

function detectThemes(
  text,
  { minOccurrences, limit = 5, subjects = [], language = "pt" } = {},
) {
  const normalizedText = normalize(text);
  const normalizedSubjects = normalize(subjects.join(" | "));
  const threshold =
    minOccurrences ??
    (countWords(text) < 150 ? 1 : countWords(text) / 600 + 1.5);

  return themes
    .map((theme) => {
      const termCount = getThemeTerms(theme, language).reduce(
        (sum, term) => sum + countTermOccurrences(normalizedText, term),
        0,
      );
      const subjectCount = theme.subjects.reduce(
        (sum, term) => sum + countTermOccurrences(normalizedSubjects, term),
        0,
      );
      return { slug: theme.slug, score: termCount + subjectCount * 2 };
    })
    .filter((theme) => theme.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((theme) => theme.slug);
}

function detectKind(categories = [], html = "") {
  const joined = normalize(categories.join(" | "));

  if (/sermo|sermao|sermoes/.test(joined)) return "sermão";
  if (/soneto|poema|poesia|poesias|versos|poems?\b|poetry/.test(joined))
    return "poema";
  if (/conto/.test(joined)) return "conto";
  if (/cronica/.test(joined)) return "crônica";
  if (/carta/.test(joined)) return "carta";
  if (/ensaio/.test(joined)) return "ensaio";
  if (/discurso|conferencia/.test(joined)) return "discurso";
  if (/class="poem"/.test(html)) return "poema";

  return null;
}

function splitIntoParts(html, targetWords = PART_TARGET_WORDS) {
  const root = parse(html);
  const blocks = root.childNodes
    .filter((node) => node.nodeType === NodeType.ELEMENT_NODE)
    .filter((node) => BLOCK_TAGS.includes(node.rawTagName?.toLowerCase()))
    .map((node) => node.toString());

  const blocksWords = countWords(toPlainText(blocks.join("")));
  if (
    blocks.length === 0 ||
    blocksWords < countWords(toPlainText(html)) * 0.9
  ) {
    return [html];
  }

  const parts = [];
  let current = [];
  let currentWords = 0;

  for (const block of blocks) {
    current.push(block);
    currentWords += countWords(toPlainText(block));

    if (currentWords >= targetWords) {
      parts.push(current.join(""));
      current = [];
      currentWords = 0;
    }
  }

  if (current.length > 0) {
    const remainingWords = countWords(toPlainText(current.join("")));
    if (parts.length > 0 && remainingWords < targetWords / 3) {
      parts[parts.length - 1] += current.join("");
    } else {
      parts.push(current.join(""));
    }
  }

  return parts;
}

function measure(html) {
  const text = toPlainText(html);
  const wordCount = countWords(text);
  return {
    html,
    text,
    wordCount,
    readingMinutes: getReadingMinutes(wordCount),
  };
}

function prepare(
  rawHtml,
  {
    allowSplit = true,
    maxMinutes = MAX_READING_MINUTES,
    maxParts = MAX_PARTS,
    language = "pt",
  } = {},
) {
  const linkDensity = getLinkDensity(rawHtml);
  const html = sanitizeHtml(rawHtml);
  const text = toPlainText(html);
  const wordCount = countWords(text);

  if (wordCount < MIN_WORDS) {
    return { rejected: "too_short" };
  }

  if (linkDensity > 0.4 || getListDensity(html) > 0.6) {
    return { rejected: "index_page" };
  }

  const detectedLanguage = detectLanguage(text);
  if (!detectedLanguage || (language && detectedLanguage !== language)) {
    return { rejected: "wrong_language" };
  }

  const readingMinutes = getReadingMinutes(wordCount);

  if (readingMinutes <= maxMinutes) {
    return {
      parts: [{ html, text, wordCount, readingMinutes }],
      text,
      language: detectedLanguage,
    };
  }

  if (!allowSplit) {
    return { rejected: "too_long" };
  }

  const parts = splitIntoParts(html).map(measure);

  if (parts.length > maxParts || parts.length === 1) {
    return { rejected: "too_long" };
  }

  return { parts, text, language: detectedLanguage };
}

const readingText = {
  MAX_READING_MINUTES,
  normalize,
  sanitizeHtml,
  getLinkDensity,
  toPlainText,
  countWords,
  getReadingMinutes,
  getExcerpt,
  isPortuguese,
  detectLanguage,
  detectThemes,
  detectKind,
  splitIntoParts,
  measure,
  prepare,
};

export default readingText;
