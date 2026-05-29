import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorizationModel from "models/authorization.js";
import systemActivityTypeModel from "models/system_activity_type.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:system_activity_type"), getHandler)
  .patch(controller.canRequest("update:system_activity_type"), patchHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;

  const systemActivityTypeObj = await systemActivityTypeModel.findBySlug(
    request.query.slugOrId,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:system_activity_type",
    systemActivityTypeObj,
  );

  return response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const systemActivityTypeId = request.query.slugOrId;
  const userInputValues = request.body;

  const systemActivityTypeObj = await systemActivityTypeModel.updateById(
    systemActivityTypeId,
    userInputValues,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPatch,
    "read:system_activity_type",
    systemActivityTypeObj,
  );

  return response.status(200).json(secureOutputValues);
}
