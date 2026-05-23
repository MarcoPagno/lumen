import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import userModel from "models/user.js";
import authorizationModel from "models/authorization";
import { ForbiddenError } from "infra/errors";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .patch(controller.canRequest("update:user:self"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const user = await userModel.findUserByUsername(request.query.username);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:user",
    user,
  );

  response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const username = request.query.username;
  const userInputValues = request.body;
  const userTryingToPatch = request.context.user;
  const targetUser = await userModel.findUserByUsername(username);

  const canUpdateSelf =
    authorizationModel.can(userTryingToPatch, "update:user:self") &&
    userTryingToPatch.id === targetUser.id;

  const canUpdateOthers = authorizationModel.can(
    userTryingToPatch,
    "update:user:others",
  );

  if (!canUpdateSelf && !canUpdateOthers) {
    throw new ForbiddenError({
      message: "Insufficient permissions to update another user",
      action: "Ensure the user has the required feature to update other users",
    });
  }

  const updatedUser = await userModel.updateUserByUsername(
    username,
    userInputValues,
  );
  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPatch,
    "read:user",
    updatedUser,
  );
  response.status(200).json(secureOutputValues);
}
