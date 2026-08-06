import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function create(userId, inputValues) {
  validateTitle(inputValues.title);

  const studiedAt = toDateOnlyString(new Date());

  const newTopic = await runInsertQuery(userId, inputValues, studiedAt);
  return newTopic;

  async function runInsertQuery(userId, inputValues, studiedAt) {
    const result = await database.query({
      text: `
        INSERT INTO topics (user_id, title, source, studied_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *, to_char(studied_at, 'YYYY-MM-DD') AS studied_at;`,
      values: [
        userId,
        inputValues.title.trim(),
        inputValues.source?.trim() || null,
        studiedAt,
      ],
    });

    return result.rows[0];
  }
}

async function findById(topicId, userId) {
  const result = await database.query({
    text: `
      SELECT *, to_char(studied_at, 'YYYY-MM-DD') AS studied_at
      FROM topics
      WHERE id = $1 AND user_id = $2
      LIMIT 1;`,
    values: [topicId, userId],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Topic not found",
      action: "Verify the provided topic ID and try again",
    });
  }

  return result.rows[0];
}

async function findAllByUser(userId) {
  const result = await database.query({
    text: `
      SELECT topics.*, to_char(studied_at, 'YYYY-MM-DD') AS studied_at
      FROM topics
      WHERE user_id = $1
      ORDER BY topics.studied_at DESC, topics.created_at DESC;`,
    values: [userId],
  });

  return result.rows;
}

async function countActiveFundamental(userId) {
  const result = await database.query({
    text: `
      SELECT COUNT(DISTINCT t.id) AS count
      FROM topics t
      JOIN reviews r ON r.topic_id = t.id
      WHERE
        t.user_id = $1
        AND t.status = 'active'
        AND r.type = 'monthly'
        AND r.promoted = true;`,
    values: [userId],
  });

  return Number(result.rows[0].count);
}

async function markCompleted(topicId) {
  const result = await database.query({
    text: `
      UPDATE topics
      SET status = 'completed', updated_at = timezone('utc', now())
      WHERE id = $1
      RETURNING *, to_char(studied_at, 'YYYY-MM-DD') AS studied_at;`,
    values: [topicId],
  });

  return result.rows[0];
}

function validateTitle(title) {
  if (!title || typeof title !== "string" || title.trim().length < 3) {
    throw new ValidationError({
      message: "Title must have at least 3 characters",
      action: "Provide a valid title for the topic",
    });
  }
}

function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

const topicModel = {
  create,
  findById,
  findAllByUser,
  countActiveFundamental,
  markCompleted,
};

export default topicModel;
