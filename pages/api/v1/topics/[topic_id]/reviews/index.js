import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import reviewModel from "models/review.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .post(controller.canRequest("create:review"), postHandler)
  .patch(controller.canRequest("create:review"), patchHandler)
  .handler(controller.errorHandlers);

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const topicId = request.query.topic_id;

  const result = await reviewModel.complete(topicId, userTryingToPost.id, {
    content: request.body.content,
  });

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "create:review",
    result,
  );

  response.status(200).json(secureOutputValues);
}

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const topicId = request.query.topic_id;

  const result = await reviewModel.decidePromotion(
    topicId,
    userTryingToPatch.id,
    request.body.promoted,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPatch,
    "create:review",
    result,
  );

  response.status(200).json(secureOutputValues);
}
