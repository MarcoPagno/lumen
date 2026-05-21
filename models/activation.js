import email from "infra/email.js";
import database from "infra/database.js";
import webserver from "infra/webserver.js";
import { NotFoundError } from "infra/errors.js";
import userModel from "models/user.js";

const EXPIRATION_IN_MILLISECONDS = 60 * 15 * 1000; //15 minutes

async function create(user) {
  const expiresAt = new Date(Date.now() + EXPIRATION_IN_MILLISECONDS);

  const newToken = await runInsertQuery(user.id, expiresAt);
  return newToken;

  async function runInsertQuery(userId, expiresAt) {
    const results = await database.query({
      text: `
        INSERT INTO user_activation_tokens (user_id, expires_at)
        VALUES ($1,$2)
        RETURNING *;`,
      values: [userId, expiresAt],
    });
    return results.rows[0];
  }
}

async function findValidTokenById(tokenId) {
  const user = await database.query({
    text: `
      SELECT * FROM user_activation_tokens 
      WHERE 
        id = $1
        AND expires_at > NOW()
        AND used_at IS NULL
      LIMIT 1;`,
    values: [tokenId],
  });

  if (user.rowCount === 0) {
    throw new NotFoundError({
      message: "Id not found",
      action: "Verify the provided user ID and try again",
      status_code: 404,
    });
  }

  return user.rows[0];
}

async function sendEmailToUser(user, activationToken) {
  await email.send({
    from: "Lumen <contact@lumen.com.br>",
    to: user.email,
    subject: "Activate your registration on Lumen!",
    text: `${user.username}, click on the link to activate your email:

${webserver.origin}/register/activate/${activationToken.id}

Regards,
Team Lumen`,
  });
}

async function markTokenAsUsed(token) {
  const usedActivationToken = await runUpdateQuery(token);
  return usedActivationToken;

  async function runUpdateQuery(tokenId) {
    const updatedActivation = await database.query({
      text: `
      UPDATE user_activation_tokens 
      SET
        used_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      WHERE 
        id = ($1)
        AND expires_at > NOW()
        AND used_at IS NULL
      RETURNING *;`,
      values: [tokenId],
    });

    return updatedActivation.rows[0];
  }
}

async function activateUserbyUserId(userId) {
  const activatedUser = await userModel.setFeatures(userId, ["create:session"]);
  return activatedUser;
}

const activationModel = {
  create,
  sendEmailToUser,
  findValidTokenById,
  markTokenAsUsed,
  activateUserbyUserId,
};

export default activationModel;
