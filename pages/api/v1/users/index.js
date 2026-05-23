import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import userModel from "models/user.js";
import activationModel from "models/activation.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:user"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const newUser = await userModel.createNewUser(request.body);

  const activationToken = await activationModel.create(newUser);

  await activationModel.sendEmailToUser(newUser, activationToken);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "read:user",
    newUser,
  );

  response.status(201).json(secureOutputValues);
}
