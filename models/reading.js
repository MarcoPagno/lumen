import database from "infra/database.js";
import localDate from "infra/date.js";
import { NotFoundError } from "infra/errors.js";
import olavo from "infra/sources/olavo.js";
import readingText from "models/reading-text.js";
import themes from "models/reading-themes.json";
import bookModel from "models/book.js";

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
        kind, area, tone, themes, year, series_id, part_number, part_total
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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

async function countRootsBySource(source) {
  const result = await database.query({
    text: `
      SELECT COUNT(*)::int AS count
      FROM readings
      WHERE source = $1 AND (part_number IS NULL OR part_number = 1);`,
    values: [source],
  });

  return result.rows[0].count;
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

  if (reading.mode !== "live") {
    return reading;
  }

  try {
    const postId = reading.external_id.split("#")[0];
    const html = readingText.sanitizeHtml(await olavo.fetchPostContent(postId));
    const content = reading.part_number
      ? readingText.splitIntoParts(html)[reading.part_number - 1]
      : html;
    return { ...reading, content: content ?? null };
  } catch {
    return { ...reading, content: null };
  }
}

async function findNextForUser(userId) {
  const today = localDate.getTodayDateOnly();

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
        user_logs AS (
          SELECT reading_logs.*, readings.author_id, readings.kind
          FROM reading_logs
          JOIN readings ON readings.id = reading_logs.reading_id
          WHERE reading_logs.user_id = $1
        ),
        recent AS (
          SELECT author_id, kind
          FROM user_logs
          WHERE status = 'read'
          ORDER BY created_at DESC
          LIMIT 3
        ),
        author_feedback AS (
          SELECT
            author_id,
            SUM(CASE reaction WHEN 'liked' THEN 1 WHEN 'disliked' THEN -1 ELSE 0 END) AS score
          FROM user_logs
          GROUP BY author_id
        ),
        candidates AS (
          SELECT
            readings.id,
            readings.author_id,
            readings.kind,
            readings.tone,
            readings.part_number,
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
            ) AS same_author
          FROM readings
          JOIN authors ON authors.id = readings.author_id
          CROSS JOIN active_themes
          WHERE
            readings.status = 'ready'
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
        )
      SELECT
        candidates.id,
        (
          3 * candidates.shared_themes
          + CASE WHEN candidates.same_author THEN 4 ELSE 0 END
          + CASE WHEN candidates.part_number > 1 THEN 8 ELSE 0 END
          + 1.5 * LEAST(GREATEST(COALESCE(author_feedback.score, 0), -3), 3)
          - CASE WHEN candidates.author_id IN (SELECT author_id FROM recent) THEN 3 ELSE 0 END
          - CASE WHEN candidates.kind = (SELECT kind FROM recent LIMIT 1) THEN 1 ELSE 0 END
          + CASE
              WHEN candidates.active_themes_count = 0 AND candidates.tone IN ('leve', 'inspirador') THEN 1
              ELSE 0
            END
          + 3 * ('x' || substr(md5($1::text || $2 || candidates.id::text), 1, 8))::bit(32)::bigint / 4294967296.0
        ) AS score
      FROM candidates
      LEFT JOIN author_feedback ON author_feedback.author_id = candidates.author_id
      ORDER BY score DESC
      LIMIT 1;`,
    values: [userId, today],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "No reading available",
      action: "Import more readings or wait for new ones",
    });
  }

  const reading = await findById(result.rows[0].id);
  const activeBooks = await bookModel.findAllByUser(userId, {
    status: "reading",
  });

  return { ...reading, reason: getReason(reading, activeBooks) };
}

function getReason(reading, activeBooks) {
  if (reading.part_number > 1) {
    return `Continuação: parte ${reading.part_number} de ${reading.part_total}`;
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

  return null;
}

const readingModel = {
  insertCandidates,
  insertProcessed,
  markReady,
  markRejected,
  findPendingBatch,
  countBySource,
  countRootsBySource,
  findById,
  findByIdWithContent,
  findNextForUser,
};

export default readingModel;
