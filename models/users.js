import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function createUser(inputValues) {
  await validateUniqueUsername(inputValues.username);
  await validateUniqueEmail(inputValues.email);

  return await runInsertQuery(inputValues);
}

async function validateUniqueUsername(username) {
  const result = await database.query({
    text: `
      SELECT username FROM users 
      WHERE LOWER(username) = LOWER($1) 
      LIMIT 1;`,
    values: [username],
  });

  if (result.rowCount != 0) {
    throw new ValidationError({
      message: "Username already in use",
      action: "Choose a different username",
    });
  }

  return result;
}

async function validateUniqueEmail(email) {
  const result = await database.query({
    text: `
      SELECT email FROM users 
      WHERE LOWER(email) = LOWER($1) 
      LIMIT 1;`,
    values: [email],
  });

  if (result.rowCount != 0) {
    throw new ValidationError({
      message: "Email already in use",
      action: "Use a different email address",
    });
  }

  return result;
}

async function runInsertQuery(inputValues) {
  const { username, email, password } = inputValues;
  const newUser = await database.query({
    text: `
      INSERT INTO users (username, email, password) 
      VALUES ($1, $2, $3) 
      RETURNING *;`,
    values: [username, email, password],
  });

  return newUser.rows[0];
}

async function findUserByUsername(username) {
  const result = await database.query({
    text: `
      SELECT * FROM users 
      WHERE LOWER(username) = LOWER($1);`,
    values: [username],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "User not found",
      action: "Check for typos or verify the identifier",
      status_code: 404,
    });
  }

  return result.rows[0];
}

const usersModel = {
  createUser,
  findUserByUsername,
};

export default usersModel;
