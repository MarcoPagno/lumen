import database from "infra/database.js";

const SIGNALS_FOR_FULL_CONFIDENCE = 15;
const DECAY_IN_DAYS = 90;

async function findForUser(userId) {
  const result = await database.query({
    text: `
      WITH
        signals AS (
          SELECT
            reading_id,
            created_at,
            CASE
              WHEN status = 'skipped' THEN -1.0
              WHEN reaction = 'liked' THEN 2.0
              WHEN reaction = 'disliked' THEN -2.0
              ELSE 0.5
            END AS weight
          FROM reading_logs
          WHERE user_id = $1
          UNION ALL
          SELECT reading_id, created_at, 3.0 AS weight
          FROM reading_favorites
          WHERE user_id = $1
        ),
        weighted AS (
          SELECT
            readings.author_id,
            readings.kind,
            readings.area,
            readings.themes,
            signals.weight * exp(
              -extract(epoch FROM (now() - signals.created_at)) / 86400.0 / $2
            ) AS weight
          FROM signals
          JOIN readings ON readings.id = signals.reading_id
        )
      SELECT 'signals' AS dimension, 'count' AS key, NULL AS label, COUNT(*)::float AS score
      FROM signals
      UNION ALL
      SELECT 'theme', theme, NULL, SUM(weight)
      FROM weighted, unnest(weighted.themes) AS theme
      GROUP BY theme
      UNION ALL
      SELECT 'author', weighted.author_id::text, MAX(authors.name), SUM(weight)
      FROM weighted
      JOIN authors ON authors.id = weighted.author_id
      GROUP BY weighted.author_id
      UNION ALL
      SELECT 'kind', kind, NULL, SUM(weight)
      FROM weighted
      WHERE kind IS NOT NULL
      GROUP BY kind
      UNION ALL
      SELECT 'area', area, NULL, SUM(weight)
      FROM weighted
      WHERE area IS NOT NULL
      GROUP BY area;`,
    values: [userId, DECAY_IN_DAYS],
  });

  return buildProfile(result.rows);
}

function buildProfile(rows) {
  const signals = rows.find((row) => row.dimension === "signals")?.score ?? 0;
  const confidence = Math.min(1, signals / SIGNALS_FOR_FULL_CONFIDENCE);

  const profile = {
    signals,
    confidence,
    themes: {},
    authors: {},
    kinds: {},
    areas: {},
    relative: { themes: {}, authors: {}, kinds: {}, areas: {} },
    labels: { authors: {} },
  };

  const dimensions = {
    theme: "themes",
    author: "authors",
    kind: "kinds",
    area: "areas",
  };

  for (const [dimension, key] of Object.entries(dimensions)) {
    const dimensionRows = rows.filter((row) => row.dimension === dimension);
    const maxScore = Math.max(
      0,
      ...dimensionRows.map((row) => Math.abs(row.score)),
    );
    if (maxScore === 0) continue;

    for (const row of dimensionRows) {
      profile.relative[key][row.key] = row.score / maxScore;
      profile[key][row.key] = (row.score / maxScore) * confidence;
      if (row.label) profile.labels[key][row.key] = row.label;
    }
  }

  return profile;
}

function getTop(scores, { limit = 5, direction = 1 } = {}) {
  return Object.entries(scores)
    .filter(([, score]) => score * direction > 0.15)
    .sort((a, b) => (b[1] - a[1]) * direction)
    .slice(0, limit)
    .map(([key, score]) => ({ key, score }));
}

function summarize(profile) {
  const withLabel = (items) =>
    items.map((item) => ({
      ...item,
      label: profile.labels.authors[item.key] ?? item.key,
    }));

  return {
    signals: profile.signals,
    confidence: profile.confidence,
    likes: {
      themes: getTop(profile.relative.themes),
      authors: withLabel(getTop(profile.relative.authors)),
      kinds: getTop(profile.relative.kinds, { limit: 3 }),
    },
    dislikes: {
      themes: getTop(profile.relative.themes, { limit: 3, direction: -1 }),
      authors: withLabel(
        getTop(profile.relative.authors, { limit: 3, direction: -1 }),
      ),
      kinds: getTop(profile.relative.kinds, { limit: 3, direction: -1 }),
    },
  };
}

const readingProfileModel = {
  findForUser,
  summarize,
};

export default readingProfileModel;
