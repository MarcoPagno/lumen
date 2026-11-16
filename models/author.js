import database from "infra/database.js";

async function findBySlug(slug) {
  const result = await database.query({
    text: `
      SELECT * FROM authors
      WHERE slug = $1
      LIMIT 1;`,
    values: [slug],
  });

  return result.rows[0];
}

async function upsert(authorConfig, summary) {
  const result = await database.query({
    text: `
      INSERT INTO authors (slug, name, birth_year, death_year, bio, image_url, wikipedia_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        birth_year = EXCLUDED.birth_year,
        death_year = EXCLUDED.death_year,
        bio = COALESCE(EXCLUDED.bio, authors.bio),
        image_url = COALESCE(EXCLUDED.image_url, authors.image_url),
        wikipedia_url = COALESCE(EXCLUDED.wikipedia_url, authors.wikipedia_url),
        updated_at = timezone('utc', now())
      RETURNING *;`,
    values: [
      authorConfig.slug,
      authorConfig.name,
      authorConfig.birth_year ?? null,
      authorConfig.death_year ?? null,
      summary?.bio ?? null,
      summary?.image_url ?? null,
      summary?.wikipedia_url ?? null,
    ],
  });

  return result.rows[0];
}

async function markDiscovered(authorId, source) {
  await database.query({
    text: `
      UPDATE authors
      SET
        discovered_at = timezone('utc', now()),
        discovered_sources = array_append(
          array_remove(discovered_sources, $2),
          $2
        ),
        updated_at = timezone('utc', now())
      WHERE id = $1;`,
    values: [authorId, source],
  });
}

async function findAllWithReadingsFromSource(source) {
  const result = await database.query({
    text: `
      SELECT DISTINCT authors.*
      FROM authors
      JOIN readings ON readings.author_id = authors.id
      WHERE readings.source = $1;`,
    values: [source],
  });

  return result.rows;
}

async function mergeInto(sourceAuthorId, targetAuthorId) {
  await database.query({
    text: `
      UPDATE readings
      SET author_id = $2, updated_at = timezone('utc', now())
      WHERE author_id = $1;`,
    values: [sourceAuthorId, targetAuthorId],
  });

  await database.query({
    text: `DELETE FROM authors WHERE id = $1;`,
    values: [sourceAuthorId],
  });
}

const authorModel = {
  findBySlug,
  upsert,
  markDiscovered,
  findAllWithReadingsFromSource,
  mergeInto,
};

export default authorModel;
