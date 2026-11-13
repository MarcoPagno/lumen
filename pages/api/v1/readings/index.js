import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingImportModel from "models/reading-import.js";
import readingModel from "models/reading.js";
import authorizationModel from "models/authorization.js";

export const config = {
  maxDuration: 60,
};

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:reading"), getHandler)
  .post(controller.canRequest("create:reading"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const list = await readingModel.findAllForUser(
    userTryingToGet.id,
    request.query,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:reading",
    list,
  );

  response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const newReading = await readingImportModel.addLink(request.body ?? {});

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "create:reading",
    { ...newReading, content: null },
  );

  response.status(201).json(secureOutputValues);
}
