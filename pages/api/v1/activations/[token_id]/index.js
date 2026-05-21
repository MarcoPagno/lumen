import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import activationModel from "models/activation.js";

const router = createRouter();

router.patch(patchHandler);

export default router.handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const activationTokenId = request.query.token_id;

  const usedActivationToken =
    await activationModel.markTokenAsUsed(activationTokenId);

  await activationModel.activateUserbyUserId(usedActivationToken.user_id);

  response.status(200).json(usedActivationToken);
}
