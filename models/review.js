import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";
import topicModel from "models/topic.js";

const TYPES = {
  INITIAL: "initial_study",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

const TYPE_PRIORITY = {
  [TYPES.MONTHLY]: 4,
  [TYPES.WEEKLY]: 3,
  [TYPES.DAILY]: 2,
  [TYPES.INITIAL]: 1,
};

// Rotating prompts so repeated reviews of the same topic force reconstruction
// from memory instead of reciting a previously written explanation.
const ANGLES = [
  "Explique o conceito do zero",
  "Conecte este tema com outro que você já estudou",
  "Dê um exemplo novo, diferente dos que você já usou",
  "Levante objeções ou contra-exemplos para o que você escreveu",
];

// The `reviews.scheduled_date` column is a `DATE`. All date-only values in
// this model are handled as plain "YYYY-MM-DD" strings (never JS `Date`)
// because `node-postgres` parses `DATE` columns in local time, which would
// silently shift the day depending on server timezone.
function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(dateOnlyString) {
  const [year, month, day] = dateOnlyString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateOnlyString, days) {
  const date = parseDateOnly(dateOnlyString);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnlyString(date);
}

function getEndOfWeekSunday(dateOnlyString) {
  const date = parseDateOnly(dateOnlyString);
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday
  const daysUntilSunday = (7 - dayOfWeek) % 7;

  // If the computed Sunday coincides with the study date itself, push the
  // weekly review to the following Sunday instead.
  return daysUntilSunday === 0
    ? addDays(dateOnlyString, 7)
    : addDays(dateOnlyString, daysUntilSunday);
}

function getEndOfMonth(dateOnlyString) {
  const date = parseDateOnly(dateOnlyString);
  const endOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  );
  return toDateOnlyString(endOfMonth);
}

function getEndOfNextMonth(dateOnlyString) {
  const date = parseDateOnly(dateOnlyString);
  const endOfNextMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0),
  );
  return toDateOnlyString(endOfNextMonth);
}

async function scheduleInitialCycle(topic, initialExplanation) {
  validateContent(initialExplanation);

  const studyDate = topic.studied_at;

  const dailyDates = [1, 2, 3].map((offset) => addDays(studyDate, offset));
  const weeklyDate = getEndOfWeekSunday(studyDate);
  const monthlyDate = getEndOfMonth(studyDate);

  const rows = await insertReviews(topic.id, [
    {
      type: TYPES.INITIAL,
      scheduledDate: studyDate,
      completedNow: true,
      content: initialExplanation,
    },
    { type: TYPES.DAILY, scheduledDate: dailyDates[0], angle: ANGLES[0] },
    { type: TYPES.DAILY, scheduledDate: dailyDates[1], angle: ANGLES[1] },
    { type: TYPES.DAILY, scheduledDate: dailyDates[2], angle: ANGLES[2] },
    { type: TYPES.WEEKLY, scheduledDate: weeklyDate, angle: ANGLES[3] },
    { type: TYPES.MONTHLY, scheduledDate: monthlyDate, angle: ANGLES[0] },
  ]);

  return rows;
}

async function insertReviews(topicId, rows) {
  const columns = 6;
  const values = [];
  const placeholders = rows.map((row, index) => {
    const base = index * columns;
    values.push(
      topicId,
      row.type,
      row.scheduledDate,
      row.completedNow ? new Date() : null,
      row.content ?? null,
      row.angle ?? null,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  const result = await database.query({
    text: `
      INSERT INTO reviews (topic_id, type, scheduled_date, completed_at, content, angle)
      VALUES ${placeholders.join(", ")}
      RETURNING *, to_char(scheduled_date, 'YYYY-MM-DD') AS scheduled_date;`,
    values,
  });

  return result.rows;
}

async function getDueQueueForUser(userId) {
  const today = toDateOnlyString(new Date());

  const result = await database.query({
    text: `
      SELECT
        r.id AS review_id,
        r.topic_id,
        r.type,
        to_char(r.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
        t.title
      FROM reviews r
      JOIN topics t ON t.id = r.topic_id
      WHERE
        t.user_id = $1
        AND r.completed_at IS NULL
        AND r.scheduled_date <= $2
      ORDER BY
        r.topic_id,
        CASE r.type
          WHEN 'monthly' THEN 4
          WHEN 'weekly' THEN 3
          WHEN 'daily' THEN 2
          ELSE 1
        END DESC,
        r.scheduled_date ASC;`,
    values: [userId, today],
  });

  const seenTopicIds = new Set();
  const queue = [];

  for (const row of result.rows) {
    if (seenTopicIds.has(row.topic_id)) continue;
    seenTopicIds.add(row.topic_id);
    queue.push(row);
  }

  return queue;
}

async function findPendingForTopic(topicId) {
  const today = toDateOnlyString(new Date());

  const result = await database.query({
    text: `
      SELECT *, to_char(scheduled_date, 'YYYY-MM-DD') AS scheduled_date
      FROM reviews
      WHERE topic_id = $1 AND completed_at IS NULL AND scheduled_date <= $2
      ORDER BY
        CASE type
          WHEN 'monthly' THEN 4
          WHEN 'weekly' THEN 3
          WHEN 'daily' THEN 2
          ELSE 1
        END DESC;`,
    values: [topicId, today],
  });

  return result.rows;
}

async function getSessionInfo(topicId, userId) {
  const topic = await topicModel.findById(topicId, userId);
  const pending = await findPendingForTopic(topicId);

  if (pending.length === 0) {
    throw new NotFoundError({
      message: "No review is due for this topic",
      action: "Check the daily queue for pending reviews",
    });
  }

  const dueReview = pending[0];

  return {
    topic_id: topic.id,
    title: topic.title,
    type: dueReview.type,
    angle: dueReview.angle,
  };
}

async function complete(topicId, userId, { content }) {
  validateContent(content);

  await topicModel.findById(topicId, userId);

  const pending = await findPendingForTopic(topicId);

  if (pending.length === 0) {
    throw new NotFoundError({
      message: "No review is due for this topic",
      action: "Check the daily queue for pending reviews",
    });
  }

  const ids = pending.map((review) => review.id);
  await runCompleteQuery(ids, content);

  // The "mark as fundamental" decision for a monthly review is made
  // afterwards, once the user has revealed the source and previous
  // explanations — see `decidePromotion`. The review is left with
  // `promoted = NULL` until that decision is made.

  return await getHistory(topicId, userId);
}

async function decidePromotion(topicId, userId, promoted) {
  if (typeof promoted !== "boolean") {
    throw new ValidationError({
      message: "`promoted` must be a boolean",
      action: "Inform whether this topic should be marked as fundamental",
    });
  }

  await topicModel.findById(topicId, userId);

  const monthlyReview = await findUndecidedMonthlyReview(topicId);

  if (!monthlyReview) {
    throw new NotFoundError({
      message: "No completed monthly review awaiting a decision was found",
      action: "Complete a monthly review before deciding if it is fundamental",
    });
  }

  await runSetPromotedQuery(monthlyReview.id, promoted);

  if (promoted) {
    await scheduleNextMonthly(topicId, monthlyReview.scheduled_date);
  } else {
    await topicModel.markCompleted(topicId);
  }

  return await getHistory(topicId, userId);
}

async function findUndecidedMonthlyReview(topicId) {
  const result = await database.query({
    text: `
      SELECT *, to_char(scheduled_date, 'YYYY-MM-DD') AS scheduled_date
      FROM reviews
      WHERE
        topic_id = $1
        AND type = 'monthly'
        AND promoted IS NULL
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1;`,
    values: [topicId],
  });

  return result.rows[0];
}

async function scheduleNextMonthly(topicId, previousScheduledDate) {
  const nextDate = getEndOfNextMonth(previousScheduledDate);
  const angleIndex = await countRotatableReviews(topicId);

  await insertReviews(topicId, [
    {
      type: TYPES.MONTHLY,
      scheduledDate: nextDate,
      angle: ANGLES[angleIndex % ANGLES.length],
    },
  ]);
}

async function countRotatableReviews(topicId) {
  const result = await database.query({
    text: `
      SELECT COUNT(*) FROM reviews
      WHERE topic_id = $1 AND type != 'initial_study';`,
    values: [topicId],
  });

  return Number(result.rows[0].count);
}

async function runCompleteQuery(ids, content) {
  const result = await database.query({
    text: `
      UPDATE reviews
      SET
        completed_at = timezone('utc', now()),
        content = $2,
        updated_at = timezone('utc', now())
      WHERE id = ANY($1::uuid[])
      RETURNING *;`,
    values: [ids, content],
  });

  return result.rows;
}

async function runSetPromotedQuery(reviewId, promoted) {
  await database.query({
    text: `
      UPDATE reviews
      SET promoted = $2, updated_at = timezone('utc', now())
      WHERE id = $1;`,
    values: [reviewId, promoted],
  });
}

async function getHistory(topicId, userId) {
  const topic = await topicModel.findById(topicId, userId);

  const result = await database.query({
    text: `
      SELECT *, to_char(scheduled_date, 'YYYY-MM-DD') AS scheduled_date
      FROM reviews
      WHERE topic_id = $1 AND completed_at IS NOT NULL
      ORDER BY completed_at ASC;`,
    values: [topicId],
  });

  return { topic, reviews: result.rows };
}

function validateContent(content) {
  if (!content || typeof content !== "string" || content.trim().length < 1) {
    throw new ValidationError({
      message: "Explanation is required",
      action: "Write your explanation from memory before saving",
    });
  }
}

const reviewModel = {
  TYPES,
  TYPE_PRIORITY,
  ANGLES,
  validateContent,
  scheduleInitialCycle,
  getDueQueueForUser,
  getSessionInfo,
  complete,
  decidePromotion,
  getHistory,
  // Exported for unit testing the pure date-scheduling logic.
  getEndOfWeekSunday,
  getEndOfMonth,
  getEndOfNextMonth,
  addDays,
};

export default reviewModel;
