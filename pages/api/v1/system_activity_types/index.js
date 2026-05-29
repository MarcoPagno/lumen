import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import authorizationModel from "models/authorization.js";
import systemActivityTypeModel from "models/system_activity_type.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:system_activity_type"), getHandler)
  .post(controller.canRequest("create:system_activity_type"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const listActivity = await systemActivityTypeModel.listSystemActivityTypes();

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:system_activity_type",
    listActivity,
  );

  return response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const createdActivityType =
    await systemActivityTypeModel.createNewSystemActivityType(request.body);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "read:system_activity_type",
    createdActivityType,
  );

  response.status(201).json(secureOutputValues);
}
