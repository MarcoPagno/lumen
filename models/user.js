import database from "infra/database.js";
import { ValidationError, NotFoundError } from "infra/errors.js";
import passwordModel from "models/password.js";

async function createNewUser(inputValues) {
  await validateUniqueUsername(inputValues.username);
  await validateUniqueEmail(inputValues.email);
  validatePassword(inputValues.password);
  await hashPasswordInObject(inputValues);
  injectDefaultFeaturesInObject(inputValues);

  return await runInsertQuery(inputValues);

  async function runInsertQuery(inputValues) {
    const { username, email, password, features } = inputValues;

    const newUser = await database.query({
      text: `
      INSERT INTO users (username, email, password, features) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *;`,
      values: [username, email, password, features],
    });

    return newUser.rows[0];
  }

  function injectDefaultFeaturesInObject(userInputValues) {
    userInputValues.features = ["read:activation_token"];
  }
}

async function findUserById(userId) {
  const result = await database.query({
    text: `
      SELECT * FROM users 
      WHERE id = ($1)
      LIMIT 1;`,
    values: [userId],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "User not found",
      action: "Verify the provided user ID and try again",
      status_code: 404,
    });
  }

  return result.rows[0];
}

async function findUserByUsername(username) {
  const result = await database.query({
    text: `
      SELECT * FROM users 
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1;`,
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

async function findUserByEmail(email) {
  const result = await database.query({
    text: `
      SELECT * FROM users 
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;`,
    values: [email],
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

async function updateUserByUsername(username, userInputValues) {
  const currentUser = await findUserByUsername(username);

  if ("username" in userInputValues) {
    await validateUniqueUsername(userInputValues.username);
  }
  if ("email" in userInputValues) {
    await validateUniqueEmail(userInputValues.email);
  }
  if ("password" in userInputValues) {
    await hashPasswordInObject(userInputValues);
  }

  const userWithNewValues = { ...currentUser, ...userInputValues };

  const updatedUser = await runUpdateQuery(userWithNewValues);
  return updatedUser;

  async function runUpdateQuery(userNewValues) {
    const { id, username, email, password } = userNewValues;

    const newUser = await database.query({
      text: `
      UPDATE users 
      SET
        username = ($2), 
        email = ($3), 
        password = ($4),
        updated_at = timezone('utc', now())
      WHERE id = ($1)
      RETURNING *;`,
      values: [id, username, email, password],
    });

    return newUser.rows[0];
  }
}

async function validateUniqueUsername(username) {
  if (username.length < 3 || username.length > 30) {
    throw new ValidationError({
      message: "Username must be between 3 and 30 characters",
      action: "Choose a username with the correct length",
    });
  }

  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    throw new ValidationError({
      message: "Username can only contain letters and numbers",
      action: "Remove any special characters from the username",
    });
  }

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError({
      message: "Email format is wrong",
      action: "Send a valid email",
    });
  }

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

function validatePassword(password) {
  if (password.length < 6 || password.length > 72) {
    throw new ValidationError({
      message: "Password must be between 6 and 72 characters",
      action: "Choose a password with the correct length",
    });
  }

  return;
}

async function hashPasswordInObject(inputValues) {
  const hashedPassword = await passwordModel.hash(inputValues.password);
  inputValues.password = hashedPassword;
}

async function setFeatures(userId, features) {
  const updatedUser = await runUpdateQuery(userId, features);
  return updatedUser;

  async function runUpdateQuery(userId, features) {
    const results = await database.query({
      text: `
      UPDATE users 
      SET
        features = ($2),
        updated_at = timezone('utc', now())
      WHERE id = ($1)
      RETURNING *;`,
      values: [userId, features],
    });

    return results.rows[0];
  }
}

async function addFeatures(userId, features) {
  const updatedUser = await runUpdateQuery(userId, features);
  return updatedUser;

  async function runUpdateQuery(userId, features) {
    const results = await database.query({
      text: `
      UPDATE users 
      SET
        features = array_cat(features, $2),
        updated_at = timezone('utc', now())
      WHERE id = ($1)
      RETURNING *;`,
      values: [userId, features],
    });

    return results.rows[0];
  }
}

const userModel = {
  createNewUser,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  updateUserByUsername,
  setFeatures,
  addFeatures,
};

export default userModel;
