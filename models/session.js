import crypto from "node:crypto";
import database from "infra/database.js";
import { UnauthorizedError } from "infra/errors.js";

const EXPIRATION_IN_MILLISECONDS = 60 * 60 * 24 * 30 * 1000; //30 days

async function create(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const newSession = await runInsertQuery(token, userId, expiresAt);
  return newSession;

  async function runInsertQuery(token, userId, expiresAt) {
    const newUser = await database.query({
      text: `
        INSERT INTO sessions (token, user_id, expires_at) 
        VALUES ($1, $2, $3) 
        RETURNING *;`,
      values: [token, userId, expiresAt],
    });

    return newUser.rows[0];
  }
}

async function renew(sessionId) {
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const newSession = await runUpdateQuery(sessionId, expiresAt);
  return newSession;

  async function runUpdateQuery(sessionId, expiresAt) {
    const newUser = await database.query({
      text: `
        UPDATE sessions
        SET 
          expires_at = ($2),
          updated_at = NOW()
        WHERE id = ($1)
        RETURNING *`,
      values: [sessionId, expiresAt],
    });

    return newUser.rows[0];
  }
}

async function expireById(sessionId) {
  const deleteSessionObject = await runUpdateQuery(sessionId);

  return deleteSessionObject;

  async function runUpdateQuery(sessionId) {
    const result = await database.query({
      text: `
        UPDATE sessions
        SET 
          expires_at = expires_at - interval '1 year',
          updated_at = NOW()
        WHERE id = ($1)
        RETURNING *`,
      values: [sessionId],
    });

    return result.rows[0];
  }
}

async function findValidSessionByToken(sessionToken) {
  const sessionFound = await runSelectQuery(sessionToken);

  return sessionFound;

  async function runSelectQuery(token) {
    const result = await database.query({
      text: `
        SELECT * FROM sessions
        WHERE
          expires_at > NOW()
          AND token = ($1)
        LIMIT 1;`,
      values: [token],
    });

    if (result.rowCount === 0) {
      throw new UnauthorizedError({
        message: "Invalid or expired session",
        action: "Authenticate and try again",
        status_code: 401,
      });
    }

    return result.rows[0];
  }
}

const sessionModel = {
  create,
  renew,
  expireById,
  findValidSessionByToken,
  EXPIRATION_IN_MILLISECONDS,
};

export default sessionModel;
