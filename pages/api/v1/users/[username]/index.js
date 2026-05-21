import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import userModel from "models/user.js";
import authorizationModel from "models/authorization";
import { ForbiddenError } from "infra/errors";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.get(getHandler);
router.patch(controller.canRequest("update:user"), patchHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const user = await userModel.findUserByUsername(request.query.username);

  return response.status(200).json(user);
}

async function patchHandler(request, response) {
  const username = request.query.username;
  const userInputValues = request.body;

  const userTryingToPatch = request.context.user;
  const targetUser = await userModel.findUserByUsername(username);

  if (!authorizationModel.can(userTryingToPatch, "update:user", targetUser)) {
    throw new ForbiddenError({
      message: "Insufficient permissions to update another user",
      action: "Ensure the user has the required feature to update other users",
    });
  }

  const updatedUser = await userModel.updateUserByUsername(
    username,
    userInputValues,
  );
  response.status(200).json(updatedUser);
}
