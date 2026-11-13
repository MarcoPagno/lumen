import database from "infra/database.js";
import readingModel from "models/reading.js";

async function findRootId(readingId) {
  const reading = await readingModel.findById(readingId);
  if (!reading.series_id) return reading.id;

  const result = await database.query({
    text: `
      SELECT id FROM readings
      WHERE series_id = $1 AND part_number = 1
      LIMIT 1;`,
    values: [reading.series_id],
  });

  return result.rows[0]?.id ?? reading.id;
}

async function add(userId, readingId) {
  const rootId = await findRootId(readingId);

  await database.query({
    text: `
      INSERT INTO reading_favorites (user_id, reading_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, reading_id) DO NOTHING;`,
    values: [userId, rootId],
  });

  return { reading_id: rootId, is_favorite: true };
}

async function remove(userId, readingId) {
  const rootId = await findRootId(readingId);

  await database.query({
    text: `
      DELETE FROM reading_favorites
      WHERE user_id = $1 AND reading_id = $2;`,
    values: [userId, rootId],
  });

  return { reading_id: rootId, is_favorite: false };
}

async function isFavorite(userId, readingId) {
  const rootId = await findRootId(readingId);

  const result = await database.query({
    text: `
      SELECT 1 FROM reading_favorites
      WHERE user_id = $1 AND reading_id = $2
      LIMIT 1;`,
    values: [userId, rootId],
  });

  return result.rowCount > 0;
}

const readingFavoriteModel = {
  add,
  remove,
  isFavorite,
};

export default readingFavoriteModel;
