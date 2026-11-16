import database from "infra/database.js";
import localDate from "infra/date.js";
import { NotFoundError } from "infra/errors.js";
import readingText from "models/reading-text.js";
import readingContent from "models/reading-content.js";
import themes from "models/reading-themes.json";
import bookModel from "models/book.js";
import readingProfileModel from "models/reading-profile.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_WITH_AUTHOR = `
  SELECT
    readings.*,
    authors.name AS author_name,
    authors.slug AS author_slug,
    authors.bio AS author_bio,
    authors.image_url AS author_image_url,
    authors.wikipedia_url AS author_wikipedia_url,
    authors.birth_year AS author_birth_year,
    authors.death_year AS author_death_year
  FROM readings
  JOIN authors ON authors.id = readings.author_id`;

async function insertCandidates(authorId, source, candidates, defaults) {
  if (candidates.length === 0) return 0;

  const columns = 8;
  const values = [];
  const placeholders = candidates.map((candidate, index) => {
    const base = index * columns;
    values.push(
      authorId,
      source,
      candidate.external_id,
      candidate.title,
      candidate.collection ?? null,
      candidate.url,
      defaults.mode ?? "stored",
      candidate.year ?? null,
    );
    return `(${Array.from({ length: columns }, (_, i) => `$${base + i + 1}`).join(", ")})`;
  });

  const result = await database.query({
    text: `
      INSERT INTO readings (author_id, source, external_id, title, collection, url, mode, year)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (source, external_id) DO NOTHING;`,
    values,
  });

  return result.rowCount;
}

async function insertProcessed(authorId, source, reading) {
  const result = await database.query({
    text: `
      INSERT INTO readings (
        author_id, source, external_id, title, collection, url, mode, status,
        rejection_reason, content, excerpt, word_count, reading_minutes,
        kind, area, tone, themes, year, series_id, part_number, part_total,
        language
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (source, external_id) DO NOTHING
      RETURNING *;`,
    values: [
      authorId,
      source,
      reading.external_id,
      reading.title,
      reading.collection ?? null,
      reading.url,
      reading.mode ?? "stored",
      reading.status,
      reading.rejection_reason ?? null,
      reading.content ?? null,
      reading.excerpt ?? null,
      reading.word_count ?? null,
      reading.reading_minutes ?? null,
      reading.kind ?? null,
      reading.area ?? null,
      reading.tone ?? null,
      reading.themes ?? [],
      reading.year ?? null,
      reading.series_id ?? null,
      reading.part_number ?? null,
      reading.part_total ?? null,
      reading.language ?? "pt",
    ],
  });

  return result.rows[0];
}

async function markReady(readingId, values) {
  const result = await database.query({
    text: `
      UPDATE readings
      SET
        status = 'ready',
        content = $2,
        excerpt = $3,
        word_count = $4,
        reading_minutes = $5,
        kind = $6,
        area = $7,
        tone = $8,
        themes = $9,
        year = COALESCE(year, $10),
        series_id = $11,
        part_number = $12,
        part_total = $13,
        title = COALESCE($14, title),
        collection = COALESCE($15, collection),
        author_id = COALESCE($16, author_id),
        language = COALESCE($17, language),
        updated_at = timezone('utc', now())
      WHERE id = $1
      RETURNING *;`,
    values: [
      readingId,
      values.content,
      values.excerpt,
      values.word_count,
      values.reading_minutes,
      values.kind,
      values.area,
      values.tone,
      values.themes,
      values.year ?? null,
      values.series_id ?? null,
      values.part_number ?? null,
      values.part_total ?? null,
      values.title ?? null,
      values.collection ?? null,
      values.author_id ?? null,
      values.language ?? null,
    ],
  });

  return result.rows[0];
}

async function markRejected(readingId, reason) {
  await database.query({
    text: `
      UPDATE readings
      SET status = 'rejected', rejection_reason = $2, updated_at = timezone('utc', now())
      WHERE id = $1;`,
    values: [readingId, reason],
  });
}

async function findPendingBatch(source, limit) {
  const result = await database.query({
    text: `
      SELECT readings.*, authors.slug AS author_slug
      FROM readings
      JOIN authors ON authors.id = readings.author_id
      WHERE readings.source = $1 AND readings.status = 'pending'
      ORDER BY md5(readings.id::text)
      LIMIT $2;`,
    values: [source, limit],
  });

  return result.rows;
}

async function countBySource(source) {
  const result = await database.query({
    text: `
      SELECT status, COUNT(*)::int AS count
      FROM readings
      WHERE source = $1
      GROUP BY status;`,
    values: [source],
  });

  const stats = { pending: 0, ready: 0, rejected: 0 };
  for (const row of result.rows) {
    stats[row.status] = row.count;
  }
  stats.total = stats.pending + stats.ready + stats.rejected;
  return stats;
}

async function countRootsByAuthor(authorId, source) {
  const result = await database.query({
    text: `
      SELECT COUNT(*)::int AS count
      FROM readings
      WHERE
        author_id = $1
        AND source = $2
        AND (part_number IS NULL OR part_number = 1);`,
    values: [authorId, source],
  });

  return result.rows[0].count;
}

async function findExistingExternalIds(source, externalIds) {
  if (externalIds.length === 0) return [];

  const result = await database.query({
    text: `
      SELECT external_id FROM readings
      WHERE source = $1 AND external_id = ANY($2::text[]);`,
    values: [source, externalIds],
  });

  return result.rows.map((row) => row.external_id);
}

async function findById(readingId) {
  if (!UUID_REGEX.test(readingId ?? "")) {
    throw new NotFoundError({
      message: "Reading not found",
      action: "Verify the provided reading ID and try again",
    });
  }

  const result = await database.query({
    text: `${SELECT_WITH_AUTHOR}
      WHERE readings.id = $1 AND readings.status = 'ready'
      LIMIT 1;`,
    values: [readingId],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Reading not found",
      action: "Verify the provided reading ID and try again",
    });
  }

  return result.rows[0];
}

async function findByIdWithContent(readingId) {
  const reading = await findById(readingId);
  return { ...reading, content: await getContent(reading) };
}

async function findNextPartId(reading) {
  if (!reading.series_id || !reading.part_number) return null;
  if (reading.part_number >= reading.part_total) return null;

  const result = await database.query({
    text: `
      SELECT id FROM readings
      WHERE series_id = $1 AND part_number = $2 AND status = 'ready'
      LIMIT 1;`,
    values: [reading.series_id, reading.part_number + 1],
  });

  return result.rows[0]?.id ?? null;
}

async function getContent(reading) {
  if (reading.mode !== "live") {
    return reading.content;
  }

  return await readingContent.fetchLiveContent(reading);
}

const LANGUAGES = ["pt", "en"];

function parseLanguages(value) {
  const languages = String(value ?? "")
    .split(",")
    .filter((language) => LANGUAGES.includes(language));
  return languages.length > 0 ? languages : LANGUAGES;
}

async function findNextForUser(userId, { languages } = {}) {
  const today = localDate.getTodayDateOnly();
  const [profile, activeBooks] = await Promise.all([
    readingProfileModel.findForUser(userId),
    bookModel.findAllByUser(userId, { status: "reading" }),
  ]);

  const result = await database.query({
    text: `
      WITH
        active_books AS (
          SELECT title, author_name, themes
          FROM books
          WHERE user_id = $1 AND status = 'reading'
        ),
        active_themes AS (
          SELECT COALESCE(array_agg(DISTINCT theme), '{}') AS themes
          FROM active_books, unnest(active_books.themes) AS theme
        ),
        recent AS (
          SELECT readings.author_id, readings.kind
          FROM reading_logs
          JOIN readings ON readings.id = reading_logs.reading_id
          WHERE reading_logs.user_id = $1 AND reading_logs.status = 'read'
          ORDER BY reading_logs.created_at DESC
          LIMIT 3
        ),
        candidates AS (
          SELECT
            readings.id,
            readings.author_id,
            readings.kind,
            readings.tone,
            readings.part_number,
            readings.source,
            cardinality(ARRAY(
              SELECT unnest(readings.themes)
              INTERSECT
              SELECT unnest(active_themes.themes)
            )) AS shared_themes,
            cardinality(active_themes.themes) AS active_themes_count,
            EXISTS (
              SELECT 1 FROM active_books
              WHERE active_books.author_name IS NOT NULL
                AND length(active_books.author_name) > 3
                AND (
                  authors.name ILIKE '%' || active_books.author_name || '%'
                  OR active_books.author_name ILIKE '%' || authors.name || '%'
                )
            ) AS same_author,
            (
              SELECT COALESCE(SUM((($3::jsonb) ->> theme)::float), 0)
              FROM unnest(readings.themes) AS theme
            ) AS theme_preference,
            COALESCE((($4::jsonb) ->> readings.author_id::text)::float, 0) AS author_preference,
            COALESCE((($5::jsonb) ->> readings.kind)::float, 0) AS kind_preference,
            COALESCE((($6::jsonb) ->> readings.area)::float, 0) AS area_preference
          FROM readings
          JOIN authors ON authors.id = readings.author_id
          CROSS JOIN active_themes
          WHERE
            readings.status = 'ready'
            AND readings.language = ANY($7::text[])
            AND NOT EXISTS (
              SELECT 1 FROM reading_logs
              WHERE reading_logs.user_id = $1 AND reading_logs.reading_id = readings.id
            )
            AND (
              readings.part_number IS NULL
              OR readings.part_number = 1
              OR EXISTS (
                SELECT 1
                FROM reading_logs
                JOIN readings AS previous ON previous.id = reading_logs.reading_id
                WHERE
                  reading_logs.user_id = $1
                  AND reading_logs.status = 'read'
                  AND previous.series_id = readings.series_id
                  AND previous.part_number = readings.part_number - 1
              )
            )
        ),
        best AS (
          SELECT
            candidates.id,
            (
              3 * candidates.shared_themes
              + CASE WHEN candidates.same_author THEN 4 ELSE 0 END
              + CASE WHEN candidates.part_number > 1 THEN 8 ELSE 0 END
              + CASE WHEN candidates.source = 'link' THEN 5 ELSE 0 END
              + 2 * LEAST(GREATEST(candidates.theme_preference, -2), 2)
              + 3 * candidates.author_preference
              + 1.5 * candidates.kind_preference
              + 1 * candidates.area_preference
              - CASE WHEN candidates.author_id IN (SELECT author_id FROM recent) THEN 3 ELSE 0 END
              - CASE WHEN candidates.kind = (SELECT kind FROM recent LIMIT 1) THEN 1 ELSE 0 END
              + CASE
                  WHEN candidates.active_themes_count = 0 AND candidates.tone IN ('leve', 'inspirador') THEN 1
                  ELSE 0
                END
              + 3 * ('x' || substr(md5($1::text || $2 || candidates.id::text), 1, 8))::bit(32)::bigint / 4294967296.0
            ) AS score
          FROM candidates
          ORDER BY score DESC
          LIMIT 1
        )
      ${SELECT_WITH_AUTHOR}
      JOIN best ON best.id = readings.id;`,
    values: [
      userId,
      today,
      JSON.stringify(profile.themes),
      JSON.stringify(profile.authors),
      JSON.stringify(profile.kinds),
      JSON.stringify(profile.areas),
      parseLanguages(languages),
    ],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "No reading available",
      action: "Import more readings or wait for new ones",
    });
  }

  const reading = result.rows[0];

  return { ...reading, reason: getReason(reading, activeBooks, profile) };
}

function getReason(reading, activeBooks, profile) {
  if (reading.part_number > 1) {
    return `Continuação: parte ${reading.part_number} de ${reading.part_total}`;
  }

  if (reading.source === "link") {
    return "Adicionado por você";
  }

  const authorBook = activeBooks.find(
    (book) =>
      book.author_name &&
      book.author_name.length > 3 &&
      (readingText
        .normalize(reading.author_name)
        .includes(readingText.normalize(book.author_name)) ||
        readingText
          .normalize(book.author_name)
          .includes(readingText.normalize(reading.author_name))),
  );

  if (authorBook) {
    return `Do mesmo autor de "${authorBook.title}"`;
  }

  const bestBook = activeBooks
    .map((book) => ({
      book,
      shared: book.themes.filter((theme) => reading.themes.includes(theme)),
    }))
    .filter((item) => item.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length)[0];

  if (bestBook) {
    const names = bestBook.shared
      .slice(0, 3)
      .map((slug) => themes.find((theme) => theme.slug === slug)?.name ?? slug);
    return `Relacionada a "${bestBook.book.title}": ${names.join(", ")}`;
  }

  if ((profile?.authors[reading.author_id] ?? 0) > 0.4) {
    return `Você costuma gostar de ${reading.author_name}`;
  }

  const favoriteTheme = reading.themes
    .map((slug) => ({ slug, score: profile?.themes[slug] ?? 0 }))
    .filter((theme) => theme.score > 0.4)
    .sort((a, b) => b.score - a.score)[0];

  if (favoriteTheme) {
    const name =
      themes.find((theme) => theme.slug === favoriteTheme.slug)?.name ??
      favoriteTheme.slug;
    return `Porque você gosta de textos sobre ${name.toLowerCase()}`;
  }

  return null;
}

const LIST_PAGE_SIZE = 30;
const LIST_STATUSES = ["read", "unread", "in_progress", "favorites"];
const ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüç";
const UNACCENTED = "aaaaaeeeeiiiiooooouuuuc";

async function findAllForUser(userId, filters = {}) {
  const status = LIST_STATUSES.includes(filters.status) ? filters.status : null;
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const search = filters.search?.trim()
    ? readingText.normalize(filters.search.trim()).replace(/[%_\\]/g, "\\$&")
    : null;

  const result = await database.query({
    text: `
      WITH roots AS (
        SELECT
          readings.*,
          authors.name AS author_name,
          authors.slug AS author_slug,
          COALESCE(readings.part_total, 1) AS parts,
          COALESCE(
            (
              SELECT SUM(parts.reading_minutes)
              FROM readings AS parts
              WHERE readings.series_id IS NOT NULL
                AND parts.series_id = readings.series_id
            ),
            readings.reading_minutes
          )::int AS total_minutes,
          (
            SELECT COUNT(*)
            FROM reading_logs
            JOIN readings AS parts ON parts.id = reading_logs.reading_id
            WHERE
              reading_logs.user_id = $1
              AND reading_logs.status = 'read'
              AND (
                parts.id = readings.id
                OR (readings.series_id IS NOT NULL AND parts.series_id = readings.series_id)
              )
          )::int AS read_parts,
          reading_favorites.created_at AS favorited_at,
          (
            cardinality(ARRAY(
              SELECT unnest(readings.themes)
              INTERSECT
              SELECT unnest(COALESCE(selected_book.themes, '{}'))
            ))
            + CASE
                WHEN length(selected_book.author_name) > 3
                  AND (
                    authors.name ILIKE '%' || selected_book.author_name || '%'
                    OR selected_book.author_name ILIKE '%' || authors.name || '%'
                  )
                THEN 3
                ELSE 0
              END
          ) AS book_relevance
        FROM readings
        JOIN authors ON authors.id = readings.author_id
        LEFT JOIN reading_favorites
          ON reading_favorites.reading_id = readings.id
          AND reading_favorites.user_id = $1
        LEFT JOIN books AS selected_book
          ON selected_book.id = $11::uuid
          AND selected_book.user_id = $1
        WHERE
          readings.status = 'ready'
          AND (readings.part_number IS NULL OR readings.part_number = 1)
          AND (
            $2::text IS NULL
            OR translate(
              lower(readings.title || ' ' || COALESCE(readings.collection, '') || ' ' || authors.name),
              '${ACCENTED}',
              '${UNACCENTED}'
            ) LIKE '%' || $2 || '%'
          )
          AND ($3::text IS NULL OR authors.slug = $3)
          AND ($4::text IS NULL OR readings.kind = $4)
          AND ($5::text IS NULL OR readings.area = $5)
          AND ($6::text IS NULL OR $6 = ANY(readings.themes))
          AND ($7::text IS NULL OR readings.source = $7)
          AND ($12::text IS NULL OR readings.language = $12)
      )
      SELECT *, COUNT(*) OVER()::int AS total_count
      FROM roots
      WHERE
        ($11::uuid IS NULL OR book_relevance > 0)
        AND (
          $8::text IS NULL
          OR ($8 = 'favorites' AND favorited_at IS NOT NULL)
          OR ($8 = 'read' AND read_parts >= parts)
          OR ($8 = 'in_progress' AND read_parts > 0 AND read_parts < parts)
          OR ($8 = 'unread' AND read_parts = 0)
        )
      ORDER BY
        CASE WHEN $11::uuid IS NOT NULL THEN book_relevance END DESC NULLS LAST,
        CASE WHEN $8 = 'favorites' THEN favorited_at END DESC NULLS LAST,
        author_name,
        collection NULLS FIRST,
        title
      LIMIT $9 OFFSET $10;`,
    values: [
      userId,
      search,
      filters.author || null,
      filters.kind || null,
      filters.area || null,
      filters.theme || null,
      filters.source || null,
      status,
      LIST_PAGE_SIZE,
      (page - 1) * LIST_PAGE_SIZE,
      UUID_REGEX.test(filters.book ?? "") ? filters.book : null,
      LANGUAGES.includes(filters.language) ? filters.language : null,
    ],
  });

  return {
    items: result.rows,
    total: result.rows[0]?.total_count ?? 0,
    page,
    page_size: LIST_PAGE_SIZE,
  };
}

async function findFacets() {
  const rootsCondition = `
    readings.status = 'ready'
    AND (readings.part_number IS NULL OR readings.part_number = 1)`;

  const [authors, kinds, areas, sources, languages] = await Promise.all([
    database.query(`
      SELECT authors.slug, authors.name, COUNT(*)::int AS count
      FROM readings
      JOIN authors ON authors.id = readings.author_id
      WHERE ${rootsCondition}
      GROUP BY authors.slug, authors.name
      ORDER BY authors.name;`),
    database.query(`
      SELECT kind AS value, COUNT(*)::int AS count
      FROM readings
      WHERE ${rootsCondition} AND kind IS NOT NULL
      GROUP BY kind
      ORDER BY count DESC;`),
    database.query(`
      SELECT area AS value, COUNT(*)::int AS count
      FROM readings
      WHERE ${rootsCondition} AND area IS NOT NULL
      GROUP BY area
      ORDER BY count DESC;`),
    database.query(`
      SELECT source AS value, COUNT(*)::int AS count
      FROM readings
      WHERE ${rootsCondition}
      GROUP BY source
      ORDER BY count DESC;`),
    database.query(`
      SELECT language AS value, COUNT(*)::int AS count
      FROM readings
      WHERE ${rootsCondition}
      GROUP BY language
      ORDER BY count DESC;`),
  ]);

  return {
    authors: authors.rows,
    kinds: kinds.rows,
    areas: areas.rows,
    sources: sources.rows,
    languages: languages.rows,
  };
}

const readingModel = {
  insertCandidates,
  insertProcessed,
  markReady,
  markRejected,
  findPendingBatch,
  countBySource,
  countRootsByAuthor,
  findExistingExternalIds,
  findById,
  findByIdWithContent,
  getContent,
  findNextPartId,
  findNextForUser,
  findAllForUser,
  findFacets,
};

export default readingModel;
