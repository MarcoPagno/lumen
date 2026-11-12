import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";
import openlibrary from "infra/sources/openlibrary.js";
import readingText from "models/reading-text.js";
import themes from "models/reading-themes.json";

const STATUSES = ["reading", "finished"];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function create(userId, inputValues) {
  validateTitle(inputValues.title);
  validateThemes(inputValues.themes);

  const title = inputValues.title.trim();
  const authorName = inputValues.author_name?.trim() || null;

  const subjects = await openlibrary.findSubjects(title, authorName);
  const detectedThemes = readingText.detectThemes(title, {
    minOccurrences: 1,
    subjects,
  });
  const bookThemes = [
    ...new Set([...(inputValues.themes ?? []), ...detectedThemes]),
  ];

  const result = await database.query({
    text: `
      INSERT INTO books (user_id, title, author_name, themes, subjects)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;`,
    values: [userId, title, authorName, bookThemes, subjects],
  });

  return result.rows[0];
}

async function findAllByUser(userId, { status } = {}) {
  const result = await database.query({
    text: `
      SELECT * FROM books
      WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
      ORDER BY status ASC, created_at DESC;`,
    values: [userId, status ?? null],
  });

  return result.rows;
}

async function findById(bookId, userId) {
  const result = UUID_REGEX.test(bookId ?? "")
    ? await database.query({
        text: `
          SELECT * FROM books
          WHERE id = $1 AND user_id = $2
          LIMIT 1;`,
        values: [bookId, userId],
      })
    : { rowCount: 0 };

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Book not found",
      action: "Verify the provided book ID and try again",
    });
  }

  return result.rows[0];
}

async function update(bookId, userId, inputValues) {
  const currentBook = await findById(bookId, userId);

  if ("status" in inputValues && !STATUSES.includes(inputValues.status)) {
    throw new ValidationError({
      message: "Invalid book status",
      action: `Use one of: ${STATUSES.join(", ")}`,
    });
  }

  if ("themes" in inputValues) {
    validateThemes(inputValues.themes);
  }

  const bookWithNewValues = { ...currentBook, ...inputValues };

  const result = await database.query({
    text: `
      UPDATE books
      SET status = $2, themes = $3, updated_at = timezone('utc', now())
      WHERE id = $1
      RETURNING *;`,
    values: [bookId, bookWithNewValues.status, bookWithNewValues.themes],
  });

  return result.rows[0];
}

function validateTitle(title) {
  if (!title || typeof title !== "string" || title.trim().length < 2) {
    throw new ValidationError({
      message: "Title must have at least 2 characters",
      action: "Provide a valid title for the book",
    });
  }
}

function validateThemes(bookThemes) {
  if (bookThemes === undefined) return;

  const validSlugs = themes.map((theme) => theme.slug);

  if (
    !Array.isArray(bookThemes) ||
    bookThemes.some((theme) => !validSlugs.includes(theme))
  ) {
    throw new ValidationError({
      message: "Invalid themes",
      action: "Choose themes from the available list",
    });
  }
}

const bookModel = {
  STATUSES,
  create,
  findAllByUser,
  findById,
  update,
};

export default bookModel;
