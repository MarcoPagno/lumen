import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import userModel from "models/user.js";

const router = createRouter();

router.post(postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const newUser = await userModel.createNewUser(request.body);

  return response.status(201).json(newUser);
}
