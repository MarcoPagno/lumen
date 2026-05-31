import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorizationModel from "models/authorization.js";
import systemActivityItemModel from "models/system_activity_item.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:system_activity_item"), patchHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const userTryingToPost = request.context.user;
  const systemActivityItemId = request.query.id;
  const userInputValues = request.body;

  const updatedActivityItem = await systemActivityItemModel.updateById(
    systemActivityItemId,
    userInputValues,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "read:system_activity_item",
    updatedActivityItem,
  );

  response.status(200).json(secureOutputValues);
}
