import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import topicModel from "models/topic.js";
import reviewModel from "models/review.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:topic:self"), getHandler)
  .post(controller.canRequest("create:topic"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const topics = await topicModel.findAllByUser(userTryingToGet.id);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:topic:self",
    topics,
  );

  response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;

  reviewModel.validateContent(request.body.initial_explanation);

  const newTopic = await topicModel.create(userTryingToPost.id, request.body);
  await reviewModel.scheduleInitialCycle(
    newTopic,
    request.body.initial_explanation,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "create:topic",
    newTopic,
  );

  response.status(201).json(secureOutputValues);
}
