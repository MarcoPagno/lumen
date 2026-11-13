import olavo from "infra/sources/olavo.js";
import vatican from "infra/sources/vatican.js";
import permanencia from "infra/sources/permanencia.js";
import webpage from "infra/sources/webpage.js";
import escritas from "infra/sources/escritas.js";
import readingText from "models/reading-text.js";

const LIVE_FETCHERS = {
  olavo: async (reading) => {
    const postId = reading.external_id.split("#")[0];
    return await olavo.fetchPostContent(postId);
  },
  vatican: async (reading) => {
    const pageHtml = await vatican.fetchPage(reading.url);

    if (vatican.isCatechismUrl(reading.url)) {
      const unitIndex = Number(/#u(\d+)$/.exec(reading.external_id)?.[1] ?? 0);
      return vatican.extractCatechismUnits(pageHtml)[unitIndex]?.html ?? null;
    }

    return vatican.extractDocumentHtml(pageHtml);
  },
  permanencia: async (reading) => {
    const pageHtml = await permanencia.fetchPage(reading.url);
    return permanencia.extractArticle(pageHtml).html;
  },
  escritas: async (reading) => {
    const pageHtml = await escritas.fetchPage(reading.url);
    return escritas.extractPoem(pageHtml).html;
  },
  link: async (reading) => {
    const pageHtml = await webpage.fetchPage(reading.url);
    return webpage.extractMain(pageHtml).html;
  },
};

async function fetchLiveContent(reading) {
  const fetcher = LIVE_FETCHERS[reading.source];
  if (!fetcher) return null;

  try {
    const rawHtml = await fetcher(reading);
    if (!rawHtml) return null;

    const html = readingText.sanitizeHtml(rawHtml);
    if (!reading.part_number) return html;

    return readingText.splitIntoParts(html)[reading.part_number - 1] ?? null;
  } catch {
    return null;
  }
}

const readingContent = {
  fetchLiveContent,
};

export default readingContent;
