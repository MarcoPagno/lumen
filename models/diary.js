import database from "infra/database.js";
import localDate from "infra/date.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RETURNING = `RETURNING *, to_char(entry_date, 'YYYY-MM-DD') AS entry_date`;

async function create(userId, inputValues) {
  validateContent(inputValues.content);

  const result = await database.query({
    text: `
      INSERT INTO diary_entries (user_id, entry_date, content)
      VALUES ($1, $2, $3)
      ${RETURNING};`,
    values: [userId, localDate.getTodayDateOnly(), inputValues.content.trim()],
  });

  return result.rows[0];
}

async function findAllByUser(userId) {
  const result = await database.query({
    text: `
      SELECT *, to_char(entry_date, 'YYYY-MM-DD') AS entry_date
      FROM diary_entries
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 500;`,
    values: [userId],
  });

  return result.rows;
}

async function findById(entryId, userId) {
  const result = UUID_REGEX.test(entryId ?? "")
    ? await database.query({
        text: `
          SELECT *, to_char(entry_date, 'YYYY-MM-DD') AS entry_date
          FROM diary_entries
          WHERE id = $1 AND user_id = $2
          LIMIT 1;`,
        values: [entryId, userId],
      })
    : { rowCount: 0 };

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Diary entry not found",
      action: "Verify the provided diary entry ID and try again",
    });
  }

  return result.rows[0];
}

async function update(entryId, userId, inputValues) {
  validateContent(inputValues.content);
  await findById(entryId, userId);

  const result = await database.query({
    text: `
      UPDATE diary_entries
      SET content = $2, updated_at = timezone('utc', now())
      WHERE id = $1
      ${RETURNING};`,
    values: [entryId, inputValues.content.trim()],
  });

  return result.rows[0];
}

async function remove(entryId, userId) {
  const entry = await findById(entryId, userId);

  await database.query({
    text: `DELETE FROM diary_entries WHERE id = $1;`,
    values: [entryId],
  });

  return entry;
}

function validateContent(content) {
  if (!content || typeof content !== "string" || !content.trim()) {
    throw new ValidationError({
      message: "Diary entry cannot be empty",
      action: "Write something before saving",
    });
  }
}

const diaryModel = {
  create,
  findAllByUser,
  findById,
  update,
  remove,
};

export default diaryModel;
