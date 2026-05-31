import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorizationModel from "models/authorization.js";
import systemActivityItemModel from "models/system_activity_item.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:system_activity_item"), postHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;

  const createdActivityItem =
    await systemActivityItemModel.createNewSystemActivityItem(request.body);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "read:system_activity_item",
    createdActivityItem,
  );

  response.status(201).json(secureOutputValues);
}
