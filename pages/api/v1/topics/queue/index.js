import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import topicModel from "models/topic.js";
import reviewModel from "models/review.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:queue:self"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;

  const queue = await reviewModel.getDueQueueForUser(userTryingToGet.id);
  const fundamentalActiveCount = await topicModel.countActiveFundamental(
    userTryingToGet.id,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:queue:self",
    { queue, fundamental_active_count: fundamentalActiveCount },
  );

  response.status(200).json(secureOutputValues);
}
