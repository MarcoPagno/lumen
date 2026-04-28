import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import userModel from "models/user.js";

const router = createRouter();

router.get(getHandler);
router.patch(patchHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const user = await userModel.findUserByUsername(request.query.username);

  return response.status(200).json(user);
}

async function patchHandler(request, response) {
  const userInputValues = request.body;

  const updatedUser = await userModel.updateUserByUsername(
    request.query.username,
    userInputValues,
  );
  response.status(200).json(updatedUser);
}
