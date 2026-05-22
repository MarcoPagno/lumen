import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import activationModel from "models/activation.js";
import authorizationModel from "models/authorization";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.patch(controller.canRequest("read:activation_token"), patchHandler);

export default router.handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const activationTokenId = request.query.token_id;

  const validActivationToken =
    await activationModel.findValidTokenById(activationTokenId);

  await activationModel.activateUserbyUserId(validActivationToken.user_id);

  const usedActivationToken =
    await activationModel.markTokenAsUsed(activationTokenId);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPatch,
    "read:activation_token",
    usedActivationToken,
  );

  response.status(200).json(secureOutputValues);
}
