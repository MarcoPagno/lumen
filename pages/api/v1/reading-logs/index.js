import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingLogModel from "models/reading-log.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:reading_log:self"), getHandler)
  .post(controller.canRequest("create:reading_log"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const logs = await readingLogModel.findAllReadByUser(userTryingToGet.id);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:reading_log:self",
    logs,
  );

  response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const log = await readingLogModel.save(userTryingToPost.id, request.body);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "create:reading_log",
    log,
  );

  response.status(201).json(secureOutputValues);
}
