import database from "infra/database.js";
import { ValidationError } from "infra/errors.js";
import readingModel from "models/reading.js";

const STATUSES = ["read", "skipped"];
const REACTIONS = ["liked", "disliked"];

async function save(userId, inputValues) {
  validate(inputValues);
  await readingModel.findById(inputValues.reading_id);

  const result = await database.query({
    text: `
      INSERT INTO reading_logs (user_id, reading_id, status, reaction, note)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, reading_id) DO UPDATE SET
        status = EXCLUDED.status,
        reaction = EXCLUDED.reaction,
        note = EXCLUDED.note,
        updated_at = timezone('utc', now())
      RETURNING *;`,
    values: [
      userId,
      inputValues.reading_id,
      inputValues.status,
      inputValues.reaction ?? null,
      inputValues.note?.trim() || null,
    ],
  });

  return result.rows[0];
}

async function findAllReadByUser(userId) {
  const result = await database.query({
    text: `
      SELECT
        reading_logs.*,
        readings.title,
        readings.kind,
        readings.area,
        readings.themes,
        readings.reading_minutes,
        readings.part_number,
        readings.part_total,
        authors.name AS author_name
      FROM reading_logs
      JOIN readings ON readings.id = reading_logs.reading_id
      JOIN authors ON authors.id = readings.author_id
      WHERE reading_logs.user_id = $1 AND reading_logs.status = 'read'
      ORDER BY reading_logs.created_at DESC
      LIMIT 500;`,
    values: [userId],
  });

  return result.rows;
}

function validate(inputValues) {
  if (!inputValues.reading_id || typeof inputValues.reading_id !== "string") {
    throw new ValidationError({
      message: "`reading_id` is required",
      action: "Inform which reading is being logged",
    });
  }

  if (!STATUSES.includes(inputValues.status)) {
    throw new ValidationError({
      message: "Invalid reading log status",
      action: `Use one of: ${STATUSES.join(", ")}`,
    });
  }

  if (
    inputValues.reaction != null &&
    !REACTIONS.includes(inputValues.reaction)
  ) {
    throw new ValidationError({
      message: "Invalid reaction",
      action: `Use one of: ${REACTIONS.join(", ")}`,
    });
  }
}

const readingLogModel = {
  STATUSES,
  REACTIONS,
  save,
  findAllReadByUser,
};

export default readingLogModel;
