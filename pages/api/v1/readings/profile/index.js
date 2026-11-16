import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingProfileModel from "models/reading-profile.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:reading_log:self"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const profile = await readingProfileModel.findForUser(userTryingToGet.id);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:reading_log:self",
    readingProfileModel.summarize(profile),
  );

  response.status(200).json(secureOutputValues);
}
