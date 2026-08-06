import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import reviewModel from "models/review.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:review_session:self"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const topicId = request.query.topic_id;

  const sessionInfo = await reviewModel.getSessionInfo(
    topicId,
    userTryingToGet.id,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:review_session:self",
    sessionInfo,
  );

  response.status(200).json(secureOutputValues);
}
