import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function createNewSystemActivityType(inputValues) {
  await validateUniqueSlug(inputValues.slug);
  await validateSourceUrl(inputValues.source, inputValues.source_url);

  return await runInsertQuery(inputValues);

  async function runInsertQuery(inputValues) {
    const {
      slug,
      name,
      category,
      color,
      is_default_active,
      frequency,
      expires_after_days,
      source,
      source_url,
    } = inputValues;

    const newSystemActivityType = await database.query({
      text: `
      INSERT INTO system_activity_types 
        (slug,
        name,
        category,
        color,
        is_default_active,
        frequency,
        expires_after_days,
        source,
        source_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *;`,
      values: [
        slug,
        name,
        category,
        color,
        is_default_active,
        frequency,
        expires_after_days,
        source,
        source_url,
      ],
    });

    return newSystemActivityType.rows[0];
  }
}

async function findById(activityId) {
  const result = await database.query({
    text: `
      SELECT * FROM system_activity_types 
      WHERE id = ($1)
      LIMIT 1;`,
    values: [activityId],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "System_activity_type not found",
      action: "Verify the provided ID and try again",
      status_code: 404,
    });
  }

  return result.rows[0];
}

async function findBySlug(slug) {
  const result = await database.query({
    text: `
      SELECT * FROM system_activity_types 
      WHERE LOWER(slug) = LOWER($1)
      LIMIT 1;`,
    values: [slug],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "System Activity Type not found",
      action: "Check for typos or verify the identifier",
      status_code: 404,
    });
  }

  return result.rows[0];
}

async function updateById(id, userInputValues) {
  const foundActivity = await findById(id);

  if ("slug" in userInputValues) {
    await validateUniqueSlug(userInputValues.slug);
  }
  if ("source_url" in userInputValues) {
    await validateSourceUrl(userInputValues.source, userInputValues.source_url);
  }

  const activityWithNewValues = { ...foundActivity, ...userInputValues };

  const updatedActivity = await runUpdateQuery(activityWithNewValues);
  return updatedActivity;

  async function runUpdateQuery(userNewValues) {
    const {
      id,
      slug,
      name,
      category,
      color,
      is_default_active,
      frequency,
      expires_after_days,
      source,
      source_url,
    } = userNewValues;
    const updatedActivitySearch = await database.query({
      text: `
      UPDATE system_activity_types
      SET
        slug = ($2),
        name = ($3),
        category = ($4),
        color = ($5),
        is_default_active = ($6),
        frequency = ($7),
        expires_after_days = ($8),
        source = ($9),
        source_url = ($10),
        updated_at = timezone('utc', now())
      WHERE id = ($1)
      RETURNING *;`,
      values: [
        id,
        slug,
        name,
        category,
        color,
        is_default_active,
        frequency,
        expires_after_days,
        source,
        source_url,
      ],
    });
    return updatedActivitySearch.rows[0];
  }
}

async function validateUniqueSlug(slug) {
  const result = await database.query({
    text: `
      SELECT slug FROM system_activity_types 
      WHERE LOWER(slug) = LOWER($1) 
      LIMIT 1;`,
    values: [slug],
  });

  if (result.rowCount != 0) {
    throw new ValidationError({
      message: "Slug already in use",
      action: "Use a different slug",
    });
  }

  return result;
}

async function validateSourceUrl(sourceType, sourceUrl) {
  if (sourceType === "rss" || sourceType == "scraping") {
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
  }
  return;
}

async function listSystemActivityTypes() {
  const activityTypeList = await runListQuery();
  return activityTypeList;

  async function runListQuery() {
    const results = await database.query({
      text: `SELECT * FROM system_activity_types;`,
    });

    return results.rows;
  }
}

const systemActivityTypeModel = {
  listSystemActivityTypes,
  createNewSystemActivityType,
  updateById,
  findBySlug,
};

export default systemActivityTypeModel;
