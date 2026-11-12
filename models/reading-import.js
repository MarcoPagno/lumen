import { randomUUID } from "node:crypto";
import { ValidationError } from "infra/errors.js";
import wikisource from "infra/sources/wikisource.js";
import olavo from "infra/sources/olavo.js";
import wikipedia from "infra/sources/wikipedia.js";
import authorModel from "models/author.js";
import readingModel from "models/reading.js";
import readingText from "models/reading-text.js";
import authorsConfig from "models/reading-authors.json";

const SOURCES = {
  wikisource: {
    name: "Wikisource",
    mode: "stored",
    importNext: importNextWikisource,
  },
  olavo: {
    name: "olavodecarvalho.org",
    mode: "live",
    importNext: importNextOlavo,
  },
};

const WIKISOURCE_BATCH_SIZE = 8;

async function importNext(source) {
  validateSource(source);
  const result = await SOURCES[source].importNext();
  const stats = await readingModel.countBySource(source);
  return { source, ...result, stats };
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

  const summary = await wikipedia.fetchSummary(authorConfig.wikipedia);
  return await authorModel.upsert(authorConfig, summary);
}

async function importNextWikisource() {
  const configs = authorsConfig.filter(
    (author) => author.source === "wikisource",
  );

  for (const authorConfig of configs) {
    const author = await ensureAuthor(authorConfig);
    if (author.discovered_at) continue;

    const candidates = await wikisource.discoverAuthorPages(authorConfig);
    const discovered = await readingModel.insertCandidates(
      author.id,
      "wikisource",
      candidates.map((candidate) => ({
        ...candidate,
        year: extractYear(candidate.external_id),
      })),
      { mode: "stored" },
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
    "wikisource",
    WIKISOURCE_BATCH_SIZE,
  );

  let ready = 0;
  let rejected = 0;

  for (const pending of batch) {
    const authorConfig = configs.find(
      (config) => config.slug === pending.author_slug,
    );
    const page = await wikisource.fetchPage(pending.external_id);

    if (!page) {
      await readingModel.markRejected(pending.id, "not_found");
      rejected++;
      continue;
    }

    const prepared = readingText.prepare(page.html);

    if (prepared.rejected) {
      await readingModel.markRejected(pending.id, prepared.rejected);
      rejected++;
      continue;
    }

    await saveParts(pending, prepared, {
      kind:
        readingText.detectKind(page.categories, page.html) ??
        authorConfig?.kind ??
        (wikisource.isChapterTitle(pending.external_id) ? "capítulo" : "texto"),
      area: authorConfig?.area ?? "literatura",
      tone: authorConfig?.tone ?? null,
      themes: readingText.detectThemes(prepared.text),
    });
    ready++;
  }

  return {
    step: "fetch",
    processed: batch.length,
    ready,
    rejected,
    done: batch.length < WIKISOURCE_BATCH_SIZE,
  };
}

async function saveParts(pending, prepared, classification) {
  const { parts } = prepared;
  const isSeries = parts.length > 1;

  await readingModel.markReady(pending.id, {
    ...classification,
    content: parts[0].html,
    excerpt: readingText.getExcerpt(parts[0].text),
    word_count: parts[0].wordCount,
    reading_minutes: parts[0].readingMinutes,
    series_id: isSeries ? pending.id : null,
    part_number: isSeries ? 1 : null,
    part_total: isSeries ? parts.length : null,
  });

  for (let index = 1; index < parts.length; index++) {
    const part = parts[index];
    await readingModel.insertProcessed(pending.author_id, pending.source, {
      ...classification,
      external_id: `${pending.external_id}#${index + 1}`,
      title: pending.title,
      collection: pending.collection,
      url: pending.url,
      year: pending.year,
      status: "ready",
      content: part.html,
      excerpt: readingText.getExcerpt(part.text),
      word_count: part.wordCount,
      reading_minutes: part.readingMinutes,
      series_id: pending.id,
      part_number: index + 1,
      part_total: parts.length,
    });
  }
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
  getStatus,
};

export default readingImportModel;
