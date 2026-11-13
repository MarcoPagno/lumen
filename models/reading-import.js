import { randomUUID } from "node:crypto";
import { ValidationError } from "infra/errors.js";
import wikisource from "infra/sources/wikisource.js";
import olavo from "infra/sources/olavo.js";
import vatican from "infra/sources/vatican.js";
import permanencia from "infra/sources/permanencia.js";
import escritas from "infra/sources/escritas.js";
import webpage from "infra/sources/webpage.js";
import wikipedia from "infra/sources/wikipedia.js";
import authorModel from "models/author.js";
import readingModel from "models/reading.js";
import readingText from "models/reading-text.js";
import authorsConfig from "models/reading-authors.json";
import themes from "models/reading-themes.json";

const DOCUMENT_MAX_PARTS = 40;

const AUTHOR_DESCRIPTION_PATTERN =
  /cat[oó]lic|padre|sacerdote|bispo|arcebispo|cardeal|te[oó]log|fil[oó]sof|escritor|jornalista|monge|santo|papa|professor|historiador|poeta/i;

const SOURCES = {
  wikisource: {
    name: "Wikisource",
    mode: "stored",
    batchSize: 8,
    discover: discoverWikisource,
    process: processWikisource,
  },
  vatican: {
    name: "vatican.va",
    mode: "live",
    batchSize: 4,
    discover: vatican.discover,
    process: processVatican,
  },
  permanencia: {
    name: "Permanência",
    mode: "live",
    batchSize: 10,
    discover: permanencia.discover,
    process: processPermanencia,
  },
  escritas: {
    name: "Escritas.org",
    mode: "live",
    batchSize: 10,
    discover: escritas.discover,
    process: processEscritas,
  },
  olavo: {
    name: "olavodecarvalho.org",
    mode: "live",
    importNext: importNextOlavo,
  },
};

const REJECTION_MESSAGES = {
  too_short: "The page has too little text to be a reading",
  index_page: "The page looks like a list of links, not a text",
  not_portuguese: "The text does not seem to be in Portuguese",
  too_long: "The text is too long to be split into quick readings",
};

async function importNext(source) {
  validateSource(source);
  const config = SOURCES[source];
  const result = config.importNext
    ? await config.importNext()
    : await importNextFromSource(source);
  const stats = await readingModel.countBySource(source);
  return { source, ...result, stats };
}

async function importAll({ budgetInMilliseconds = 200000 } = {}) {
  const startedAt = Date.now();
  const sources = {};

  for (const source of Object.keys(SOURCES)) {
    while (Date.now() - startedAt < budgetInMilliseconds) {
      const result = await importNext(source);
      sources[source] = result.stats;
      if (result.done) break;
    }
  }

  return { sources, elapsed_in_milliseconds: Date.now() - startedAt };
}

async function getStatus() {
  const sources = [];

  for (const [key, config] of Object.entries(SOURCES)) {
    sources.push({
      source: key,
      name: config.name,
      authors: authorsConfig
        .filter((author) => author.source === key)
        .map((author) => author.name),
      stats: await readingModel.countBySource(key),
    });
  }

  return sources;
}

async function ensureAuthor(authorConfig) {
  const existing = await authorModel.findBySlug(authorConfig.slug);
  if (existing?.bio) return existing;

  const summary = authorConfig.wikipedia
    ? await wikipedia.fetchSummary(authorConfig.wikipedia)
    : null;
  return await authorModel.upsert(authorConfig, summary);
}

async function importNextFromSource(source) {
  const sourceConfig = SOURCES[source];
  const configs = authorsConfig.filter((author) => author.source === source);

  for (const authorConfig of configs) {
    const author = await ensureAuthor(authorConfig);
    if (author.discovered_at) continue;

    const candidates = await sourceConfig.discover(authorConfig);
    const discovered = await readingModel.insertCandidates(
      author.id,
      source,
      candidates,
      { mode: sourceConfig.mode },
    );
    await authorModel.markDiscovered(author.id);

    return {
      step: "discover",
      author: authorConfig.name,
      discovered,
      done: false,
    };
  }

  const batch = await readingModel.findPendingBatch(
    source,
    sourceConfig.batchSize,
  );

  let ready = 0;
  let rejected = 0;

  for (const pending of batch) {
    const authorConfig = configs.find(
      (config) => config.slug === pending.author_slug,
    );
    const result = await sourceConfig.process(pending, authorConfig);

    if (result.rejected) {
      await readingModel.markRejected(pending.id, result.rejected);
      rejected++;
      continue;
    }

    await saveItems(pending, result, sourceConfig.mode);
    ready++;
  }

  return {
    step: "fetch",
    processed: batch.length,
    ready,
    rejected,
    done: batch.length < sourceConfig.batchSize,
  };
}

async function saveItems(pending, result, mode) {
  const { items, isSeries, classification } = result;
  const series = isSeries && items.length > 1;
  const authorId = result.authorId ?? pending.author_id;

  for (const [index, item] of items.entries()) {
    const values = {
      ...classification,
      themes: item.themes ?? classification.themes,
      title: item.title ?? pending.title,
      collection: item.collection ?? pending.collection,
      content: mode === "stored" ? item.html : null,
      excerpt: readingText.getExcerpt(item.text),
      word_count: item.wordCount,
      reading_minutes: item.readingMinutes,
      series_id: series ? pending.id : null,
      part_number: series ? index + 1 : null,
      part_total: series ? items.length : null,
      author_id: authorId,
    };

    if (index === 0) {
      await readingModel.markReady(pending.id, values);
      continue;
    }

    const suffix = series ? `#${index + 1}` : `#u${index}`;
    await readingModel.insertProcessed(authorId, pending.source, {
      ...values,
      external_id: `${pending.external_id}${suffix}`,
      url: pending.url,
      year: pending.year,
      mode,
      status: "ready",
    });
  }
}

async function discoverWikisource(authorConfig) {
  const candidates = await wikisource.discoverAuthorPages(authorConfig);
  return candidates.map((candidate) => ({
    ...candidate,
    year: extractYear(candidate.external_id),
  }));
}

async function processWikisource(pending, authorConfig) {
  const page = await wikisource.fetchPage(pending.external_id);
  if (!page) return { rejected: "not_found" };

  const prepared = readingText.prepare(page.html);
  if (prepared.rejected) return prepared;

  return {
    items: prepared.parts,
    isSeries: true,
    classification: {
      kind:
        readingText.detectKind(page.categories, page.html) ??
        authorConfig?.kind ??
        (wikisource.isChapterTitle(pending.external_id) ? "capítulo" : "texto"),
      area: authorConfig?.area ?? "literatura",
      tone: authorConfig?.tone ?? null,
      themes: readingText.detectThemes(prepared.text),
    },
  };
}

async function processVatican(pending, authorConfig) {
  const pageHtml = await vatican.fetchPage(pending.url);
  const classification = {
    kind: vatican.getKind(pending.url),
    area: authorConfig?.area ?? "teologia",
    tone: authorConfig?.tone ?? "inspirador",
    themes: [],
  };

  if (vatican.isCatechismUrl(pending.url)) {
    const items = vatican.extractCatechismUnits(pageHtml).map((unit) => {
      const measured = readingText.measure(readingText.sanitizeHtml(unit.html));
      return {
        ...measured,
        title: unit.title,
        collection: unit.collection,
        themes: readingText.detectThemes(measured.text),
      };
    });

    if (items.length === 0) return { rejected: "too_short" };
    return { items, isSeries: false, classification };
  }

  const prepared = readingText.prepare(vatican.extractDocumentHtml(pageHtml), {
    maxParts: DOCUMENT_MAX_PARTS,
  });
  if (prepared.rejected) return prepared;

  return {
    items: prepared.parts,
    isSeries: true,
    classification: {
      ...classification,
      themes: readingText.detectThemes(prepared.text),
    },
  };
}

async function processPermanencia(pending, authorConfig) {
  const article = permanencia.extractArticle(
    await permanencia.fetchPage(pending.url),
  );
  const prepared = readingText.prepare(article.html);
  if (prepared.rejected) return prepared;

  const list = authorConfig?.lists?.find((item) =>
    pending.collection?.startsWith(item.name),
  );
  const articleAuthor = article.author
    ? await ensureAuthorByName(article.author)
    : null;

  return {
    items: prepared.parts.map((part) => ({
      ...part,
      title: article.title ?? pending.title,
    })),
    isSeries: true,
    authorId: articleAuthor?.id,
    classification: {
      kind: authorConfig?.kind ?? "artigo",
      area: list?.area ?? authorConfig?.area ?? "teologia",
      tone: authorConfig?.tone ?? null,
      themes: readingText.detectThemes(prepared.text),
    },
  };
}

async function processEscritas(pending, authorConfig) {
  const poem = escritas.extractPoem(
    await escritas.fetchPage(pending.url),
    authorConfig.escritas_slug,
  );
  if (!poem.isFromAuthor) return { rejected: "other_author" };

  const prepared = readingText.prepare(poem.html);
  if (prepared.rejected) return prepared;

  return {
    items: prepared.parts.map((part) => ({
      ...part,
      title: poem.title ?? pending.title,
    })),
    isSeries: true,
    classification: {
      kind: authorConfig.kind ?? "poema",
      area: authorConfig.area ?? "literatura",
      tone: authorConfig.tone ?? null,
      themes: readingText.detectThemes(prepared.text),
    },
  };
}

async function ensureAuthorByName(rawName) {
  const name = rawName
    .split(/\s+-\s+|[,(–—]/)[0]
    .replace(/^(por|by)\s+/i, "")
    .trim();
  if (name.length < 4 || name.length > 60) return null;

  const slug = slugify(name);
  const existing = await authorModel.findBySlug(slug);
  if (existing) return existing;

  const summary = await wikipedia.fetchSummary(name.replace(/ /g, "_"));
  const isRelevant = AUTHOR_DESCRIPTION_PATTERN.test(summary?.bio ?? "");

  return await authorModel.upsert({ slug, name }, isRelevant ? summary : null);
}

async function importNextOlavo() {
  const authorConfig = authorsConfig.find(
    (author) => author.source === "olavo",
  );
  const author = await ensureAuthor(authorConfig);

  const total = await readingModel.countRootsBySource("olavo");
  const page = Math.floor(total / olavo.PAGE_SIZE) + 1;
  const posts = await olavo.listPosts(page);

  let ready = 0;
  let rejected = 0;

  for (const post of posts) {
    const prepared = post.is_from_site
      ? readingText.prepare(post.html)
      : { rejected: "external_link" };

    const baseReading = {
      external_id: post.external_id,
      title: post.title || "Sem título",
      url: post.url,
      year: post.year,
      mode: "live",
    };

    if (prepared.rejected) {
      await readingModel.insertProcessed(author.id, "olavo", {
        ...baseReading,
        status: "rejected",
        rejection_reason: prepared.rejected,
      });
      rejected++;
      continue;
    }

    const { parts } = prepared;
    const isSeries = parts.length > 1;
    const seriesId = isSeries ? randomUUID() : null;
    const themes = readingText.detectThemes(prepared.text);

    for (const [index, part] of parts.entries()) {
      await readingModel.insertProcessed(author.id, "olavo", {
        ...baseReading,
        external_id:
          index === 0 ? post.external_id : `${post.external_id}#${index + 1}`,
        status: "ready",
        excerpt: readingText.getExcerpt(part.text),
        word_count: part.wordCount,
        reading_minutes: part.readingMinutes,
        kind: authorConfig.kind,
        area: authorConfig.area,
        tone: authorConfig.tone,
        themes,
        series_id: seriesId,
        part_number: isSeries ? index + 1 : null,
        part_total: isSeries ? parts.length : null,
      });
    }
    ready++;
  }

  return {
    step: "fetch",
    processed: posts.length,
    ready,
    rejected,
    done: posts.length < olavo.PAGE_SIZE,
  };
}

async function addLink(inputValues) {
  const url = webpage.validateUrl(inputValues.url);

  let page;
  try {
    page = webpage.extractMain(await webpage.fetchPage(url));
  } catch {
    throw new ValidationError({
      message: "Could not access the page",
      action: "Check if the address is correct and publicly accessible",
    });
  }

  const prepared = readingText.prepare(page.html, {
    maxParts: DOCUMENT_MAX_PARTS,
  });

  if (prepared.rejected) {
    throw new ValidationError({
      message: REJECTION_MESSAGES[prepared.rejected],
      action: "Try another page with the full text of the reading",
    });
  }

  const authorName =
    inputValues.author_name?.trim() || page.author || new URL(url).hostname;
  const author = await ensureAuthor({
    slug: slugify(authorName),
    name: authorName,
    wikipedia: inputValues.author_name?.trim()
      ? authorName.replace(/ /g, "_")
      : null,
  });

  const textThemes = readingText.detectThemes(prepared.text);
  const isSeries = prepared.parts.length > 1;
  const seriesId = isSeries ? randomUUID() : null;
  let firstReading;

  for (const [index, part] of prepared.parts.entries()) {
    const reading = await readingModel.insertProcessed(author.id, "link", {
      external_id: index === 0 ? url : `${url}#${index + 1}`,
      title: page.title || authorName,
      url,
      mode: "live",
      status: "ready",
      excerpt: readingText.getExcerpt(part.text),
      word_count: part.wordCount,
      reading_minutes: part.readingMinutes,
      kind: "artigo",
      area: getMainArea(textThemes),
      themes: textThemes,
      series_id: seriesId,
      part_number: isSeries ? index + 1 : null,
      part_total: isSeries ? prepared.parts.length : null,
    });

    if (!reading) {
      throw new ValidationError({
        message: "This page was already added",
        action: "Find it in your readings or add another page",
      });
    }

    firstReading ??= reading;
  }

  return await readingModel.findById(firstReading.id);
}

function getMainArea(readingThemes) {
  const counts = {};
  for (const slug of readingThemes) {
    const area = themes.find((theme) => theme.slug === slug)?.area;
    if (area) counts[area] = (counts[area] ?? 0) + 1;
  }

  return (
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "literatura"
  );
}

function slugify(text) {
  return readingText
    .normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractYear(title) {
  const match = title.match(/\((\d{4})\)/);
  return match ? Number(match[1]) : null;
}

function validateSource(source) {
  if (!Object.keys(SOURCES).includes(source)) {
    throw new ValidationError({
      message: "Invalid import source",
      action: `Use one of: ${Object.keys(SOURCES).join(", ")}`,
    });
  }
}

const readingImportModel = {
  SOURCES,
  importNext,
  importAll,
  getStatus,
  addLink,
};

export default readingImportModel;
