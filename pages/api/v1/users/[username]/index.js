import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import usersModel from "models/users.js";

const router = createRouter();

router.get(getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const user = await usersModel.findUserByUsername(request.query.username);

  return response.status(200).json(user);
}
