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
  const readingId = request.query.reading_id;

  const reading = await readingModel.findByIdWithContent(readingId);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:reading",
    reading,
  );

  response.status(200).json(secureOutputValues);
}
