import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingImportModel from "models/reading-import.js";
import authorizationModel from "models/authorization.js";

export const config = {
  maxDuration: 300,
};

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("create:reading_import"), getHandler)
  .post(controller.canRequest("create:reading_import"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const status = await readingImportModel.getStatus();

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "create:reading_import",
    status,
  );

  response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const result = await readingImportModel.importNext(request.body?.source);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "create:reading_import",
    result,
  );

  response.status(200).json(secureOutputValues);
}
