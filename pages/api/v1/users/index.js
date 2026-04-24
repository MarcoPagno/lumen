import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import usersModel from "models/users.js";

const router = createRouter();

router.post(postHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const newUser = await usersModel.createUser(request.body);

  return response.status(201).json(newUser);
}
