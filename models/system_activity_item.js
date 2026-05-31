import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import systemActivityTypeModel from "./system_activity_type";

async function createNewSystemActivityItem(inputValues) {
  await validateSystemActivityType(inputValues.system_activity_type_id);
  await validateUniqueTitle(inputValues.title);
  await validateUrl(inputValues.url);
  await validatePublishedAtFormat(inputValues.published_at);

  return await runInsertQuery(inputValues);

  async function runInsertQuery(inputValues) {
    const { system_activity_type_id, title, subtitle, url, published_at } =
      inputValues;

    const newSystemActivityItem = await database.query({
      text: `
      INSERT INTO system_activity_items 
        (system_activity_type_id,
        title,
        subtitle,
        url,
        published_at)
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *;`,
      values: [system_activity_type_id, title, subtitle, url, published_at],
    });

    return newSystemActivityItem.rows[0];
  }
}

async function findById(activityId) {
  const result = await database.query({
    text: `
      SELECT * FROM system_activity_items 
      WHERE id = ($1)
      LIMIT 1;`,
    values: [activityId],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "system_activity_item not found",
      action: "Verify the provided ID and try again",
      status_code: 404,
    });
  }

  return result.rows[0];
}

async function updateById(id, userInputValues) {
  const foundActivity = await findById(id);

  if ("system_activity_type_id" in userInputValues) {
    await validateSystemActivityType(userInputValues.system_activity_type_id);
  }
  if ("title" in userInputValues) {
    await validateUniqueTitle(userInputValues.title);
  }
  if ("url" in userInputValues) {
    await validateUrl(userInputValues.url);
  }
  if ("published_at" in userInputValues) {
    await validatePublishedAtFormat(userInputValues.published_at);
  }

  const activityWithNewValues = { ...foundActivity, ...userInputValues };

  const updatedActivity = await runUpdateQuery(activityWithNewValues);
  return updatedActivity;

  async function runUpdateQuery(userNewValues) {
    const { id, system_activity_type_id, title, subtitle, url, published_at } =
      userNewValues;
    const updatedActivitySearch = await database.query({
      text: `
      UPDATE system_activity_items
      SET
        system_activity_type_id = ($2),
        title = ($3),
        subtitle = ($4),
        url = ($5),
        published_at = ($6),
        updated_at = timezone('utc', now())
      WHERE id = ($1)
      RETURNING *;`,
      values: [id, system_activity_type_id, title, subtitle, url, published_at],
    });
    return updatedActivitySearch.rows[0];
  }
}

async function validateSystemActivityType(systemActivityTypeId) {
  return await systemActivityTypeModel.findById(systemActivityTypeId);
}

async function validateUniqueTitle(title) {
  if (title.length < 3 || title.length > 300) {
    throw new ValidationError({
      message: "Title must be between greater than 3",
      action: "Choose a title with the correct length",
    });
  }

  const result = await database.query({
    text: `
      SELECT title FROM system_activity_items 
      WHERE LOWER(title) = LOWER($1)
      LIMIT 1;`,
    values: [title],
  });

  if (result.rowCount != 0) {
    throw new ValidationError({
      message: "Title already in use",
      action: "Choose a different title",
    });
  }

  return result;
}

async function validateUrl(sourceUrl) {
  let response;

  try {
    response = await fetch(sourceUrl);
  } catch (networkError) {
    throw new NotFoundError({
      message:
        "The endpoint could not be reached or returned an invalid response",
      action: "Verify the URL, ensure the endpoint is active, and try again",
      cause: networkError,
    });
  }

  if (!response.ok) {
    throw new NotFoundError({
      message: `The endpoint returned an invalid response status: ${response.status}`,
      action: "Verify the URL, ensure the endpoint is active, and try again",
    });
  }
  return;
}

async function validatePublishedAtFormat(publishedDate) {
  if (isNaN(Date.parse(publishedDate))) {
    throw new ValidationError({
      message: "published_at date is at wrong format",
      action: "The format needs to be timestamptz(2000-12-31T01:00:00.000Z)",
    });
  }
}

const systemActivityItemModel = {
  createNewSystemActivityItem,
  updateById,
};

export default systemActivityItemModel;
