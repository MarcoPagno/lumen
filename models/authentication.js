import { UnauthorizedError, NotFoundError } from "infra/errors";
import userModel from "models/user.js";
import passwordModel from "models/password.js";

async function getAuthenticatedUser(providedEmail, providedPassword) {
  try {
    const storedUser = await findUserByEmail(providedEmail);
    await validatePassword(providedPassword, storedUser.password);
    return storedUser;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new UnauthorizedError({
        message: "Invalid authentication credentials",
        action: "Verify the provided credentials and try again",
      });
    }
    throw error;
  }
}

async function findUserByEmail(providedEmail) {
  let storedUser;
  try {
    storedUser = await userModel.findUserByEmail(providedEmail);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new UnauthorizedError({
        message: "Invalid email",
        action: "Verify your credentials and try again",
      });
    }

    throw error;
  }
  return storedUser;
}

async function validatePassword(providedPassword, storedPassword) {
  const correctPasswordMatch = await passwordModel.compare(
    providedPassword,
    storedPassword,
  );

  if (!correctPasswordMatch) {
    throw new UnauthorizedError({
      message: "Invalid password",
      action: "Verify your credentials and try again",
    });
  }
}

const authenticationModel = {
  getAuthenticatedUser,
};

export default authenticationModel;
