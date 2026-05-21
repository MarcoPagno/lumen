import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import userModel from "models/user.js";
import activationModel from "models/activation.js";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:user"), postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const newUser = await userModel.createNewUser(request.body);

  const activationToken = await activationModel.create(newUser);

  await activationModel.sendEmailToUser(newUser, activationToken);

  return response.status(201).json(newUser);
}
