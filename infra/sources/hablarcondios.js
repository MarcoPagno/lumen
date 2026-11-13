import { parse } from "node-html-parser";
import readingText from "models/reading-text.js";

const MEDITATION_URL = "https://hablarcondios.org/pt/meditacao-diaria/";

function extractMeditation(pageHtml) {
  const article = parse(pageHtml).querySelector("article");
  if (!article) return null;

  const heading = article.querySelector("h1");
  const title = heading?.text.trim() || null;
  heading?.remove();
  article.querySelectorAll("figure").forEach((node) => node.remove());

  const html = readingText.sanitizeHtml(article.innerHTML);
  if (!html) return null;

  return { title, html };
}

const hablarcondios = {
  MEDITATION_URL,
  extractMeditation,
};

export default hablarcondios;
