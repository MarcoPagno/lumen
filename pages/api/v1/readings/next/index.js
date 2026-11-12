import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingModel from "models/reading.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:reading"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;

  const reading = await readingModel.findNextForUser(userTryingToGet.id);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:reading",
    { ...reading, content: null },
  );

  response.status(200).json(secureOutputValues);
}
