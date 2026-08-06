import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import topicModel from "models/topic.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:topic:self"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const topicId = request.query.topic_id;

  const topic = await topicModel.findById(topicId, userTryingToGet.id);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:topic:self",
    topic,
  );

  response.status(200).json(secureOutputValues);
}
