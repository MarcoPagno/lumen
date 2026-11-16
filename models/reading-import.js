import { createHash, randomUUID } from "node:crypto";
import { ValidationError } from "infra/errors.js";
import wikisource from "infra/sources/wikisource.js";
import olavo from "infra/sources/olavo.js";
import vatican from "infra/sources/vatican.js";
import permanencia from "infra/sources/permanencia.js";
import escritas from "infra/sources/escritas.js";
import wikiquote from "infra/sources/wikiquote.js";
import blogger from "infra/sources/blogger.js";
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
    fallbackAuthorSlug: "revista-permanencia",
  },
  escritas: {
    name: "Escritas.org",
    mode: "live",
    batchSize: 10,
    discover: escritas.discover,
    process: processEscritas,
  },
  wikiquote: {
    name: "Wikiquote",
    mode: "stored",
    batchSize: 5,
    discover: wikiquote.discover,
    process: processWikiquote,
  },
  olavo: {
    name: "olavodecarvalho.org",
    mode: "live",
    importNext: () => importNextPaged("olavo"),
    listPosts: (authorConfig, offset) =>
      olavo.listPosts(Math.floor(offset / olavo.PAGE_SIZE) + 1),
    pageSize: olavo.PAGE_SIZE,
  },
  blogger: {
    name: "Blogs (Blogger)",
    mode: "live",
    importNext: () => importNextPaged("blogger"),
    listPosts: (authorConfig, offset) =>
      blogger.listPosts(authorConfig.blog_url, offset + 1),
    pageSize: blogger.PAGE_SIZE,
    checkForNewPosts: true,
  },
};

const REJECTION_MESSAGES = {
  too_short: "The page has too little text to be a reading",
  index_page: "The page looks like a list of links, not a text",
  wrong_language: "The text must be in Portuguese or English",
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
    ? await wikipedia.fetchSummary(
        authorConfig.wikipedia,
        authorConfig.wikipedia_lang,
      )
    : null;
  return await authorModel.upsert(authorConfig, summary);
}

async function importNextFromSource(source) {
  const sourceConfig = SOURCES[source];
  const configs = authorsConfig.filter((author) => author.source === source);

  if (sourceConfig.fallbackAuthorSlug) {
    await cleanupInvalidAuthors(source, sourceConfig.fallbackAuthorSlug);
  }

  for (const authorConfig of configs) {
    const author = await ensureAuthor(authorConfig);
    const discoveryKey = getDiscoveryKey(source, authorConfig);
    if (author.discovered_sources?.includes(discoveryKey)) continue;

    const candidates = await sourceConfig.discover(authorConfig);
    const discovered = await readingModel.insertCandidates(
      author.id,
      source,
      candidates,
      { mode: sourceConfig.mode },
    );
    await authorModel.markDiscovered(author.id, discoveryKey);

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

function getDiscoveryKey(source, authorConfig) {
  const discoveryConfig = {
    pages: authorConfig.pages,
    prefixes: authorConfig.prefixes,
    categories: authorConfig.categories,
    quote_pages: authorConfig.quote_pages,
    lists: authorConfig.lists,
    indexes: authorConfig.indexes,
    documents: authorConfig.documents,
    catechism: authorConfig.catechism,
    escritas_slug: authorConfig.escritas_slug,
    wikisource_lang: authorConfig.wikisource_lang,
  };
  const hash = createHash("md5")
    .update(JSON.stringify(discoveryConfig))
    .digest("hex")
    .slice(0, 10);
  return `${source}:${hash}`;
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

  const language = authorConfig?.language ?? "pt";
  const prepared = readingText.prepare(page.html, { language });
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
      language,
      themes: readingText.detectThemes(prepared.text, { language }),
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

async function processWikiquote(pending, authorConfig) {
  const { lang: language } = wikiquote.parseExternalId(pending.external_id);
  const pageHtml = await wikiquote.fetchPage(pending.external_id);
  if (!pageHtml) return { rejected: "not_found" };

  const quotes = wikiquote
    .extractQuotes(pageHtml)
    .filter((quote) => readingText.detectLanguage(quote.text) === language);
  if (quotes.length < 3) return { rejected: "too_short" };

  const groups = wikiquote.groupQuotes(quotes);
  const items = groups.map((groupHtml, index) => {
    const measured = readingText.measure(readingText.sanitizeHtml(groupHtml));
    return {
      ...measured,
      title:
        groups.length > 1 ? `${pending.title} (${index + 1})` : pending.title,
      themes: readingText.detectThemes(measured.text, {
        minOccurrences: 1,
        language,
      }),
    };
  });

  return {
    items,
    isSeries: false,
    classification: {
      kind: "pensamentos",
      area: authorConfig?.area ?? "filosofia",
      tone: authorConfig?.tone ?? "inspirador",
      language,
      themes: [],
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

async function cleanupInvalidAuthors(source, fallbackAuthorSlug) {
  const configuredSlugs = new Set(authorsConfig.map((author) => author.slug));
  const fallbackAuthor = await ensureAuthor(
    authorsConfig.find((author) => author.slug === fallbackAuthorSlug),
  );

  const authors = await authorModel.findAllWithReadingsFromSource(source);
  let cleaned = 0;

  for (const author of authors) {
    if (configuredSlugs.has(author.slug)) continue;
    if (permanencia.isPlausibleAuthorName(author.name)) continue;

    await authorModel.mergeInto(author.id, fallbackAuthor.id);
    cleaned++;
  }

  return cleaned;
}

async function ensureAuthorByName(rawName) {
  const name = rawName
    .split(/\s+-\s+|[,(–—]/)[0]
    .replace(/^(por|by)\s+/i, "")
    .trim();
  if (!permanencia.isPlausibleAuthorName(name)) return null;

  const slug = slugify(name);
  const existing = await authorModel.findBySlug(slug);
  if (existing) return existing;

  const summary = await wikipedia.fetchSummary(name.replace(/ /g, "_"));
  const isRelevant = AUTHOR_DESCRIPTION_PATTERN.test(summary?.bio ?? "");

  return await authorModel.upsert({ slug, name }, isRelevant ? summary : null);
}

async function importNextPaged(source) {
  const sourceConfig = SOURCES[source];
  const configs = authorsConfig.filter((author) => author.source === source);

  for (const authorConfig of configs) {
    const author = await ensureAuthor(authorConfig);
    const total = await readingModel.countRootsByAuthor(author.id, source);
    let posts = await sourceConfig.listPosts(authorConfig, total);

    if (posts.length === 0 && sourceConfig.checkForNewPosts) {
      const latest = await sourceConfig.listPosts(authorConfig, 0);
      const existing = await readingModel.findExistingExternalIds(
        source,
        latest.map((post) => post.external_id),
      );
      posts = latest.filter((post) => !existing.includes(post.external_id));
    }

    if (posts.length === 0) continue;

    const result = await savePosts(source, author, authorConfig, posts);
    return { step: "fetch", ...result, done: false };
  }

  return { step: "fetch", processed: 0, ready: 0, rejected: 0, done: true };
}

async function savePosts(source, author, authorConfig, posts) {
  const language = authorConfig.language ?? "pt";
  let ready = 0;
  let rejected = 0;

  for (const post of posts) {
    const prepared = post.is_from_site
      ? readingText.prepare(post.html, { language })
      : { rejected: "external_link" };

    const baseReading = {
      external_id: post.external_id,
      title: post.title || "Sem título",
      url: post.url,
      year: post.year,
      mode: "live",
      language,
    };

    if (prepared.rejected) {
      await readingModel.insertProcessed(author.id, source, {
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
    const postThemes = readingText.detectThemes(prepared.text, { language });

    for (const [index, part] of parts.entries()) {
      await readingModel.insertProcessed(author.id, source, {
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
        themes: postThemes,
        series_id: seriesId,
        part_number: isSeries ? index + 1 : null,
        part_total: isSeries ? parts.length : null,
      });
    }
    ready++;
  }

  return { processed: posts.length, ready, rejected };
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
    language: null,
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

  const textThemes = readingText.detectThemes(prepared.text, {
    language: prepared.language,
  });
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
      language: prepared.language,
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
  cleanupInvalidAuthors,
  addLink,
};

export default readingImportModel;
