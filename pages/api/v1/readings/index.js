import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingImportModel from "models/reading-import.js";
import authorizationModel from "models/authorization.js";

export const config = {
  maxDuration: 60,
};

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:reading"), postHandler)
  .handler(controller.errorHandlers);

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
