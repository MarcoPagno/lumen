import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import diaryModel from "models/diary.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:diary_entry:self"), getHandler)
  .post(controller.canRequest("create:diary_entry"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const entries = await diaryModel.findAllByUser(userTryingToGet.id);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:diary_entry:self",
    entries,
  );

  response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const newEntry = await diaryModel.create(userTryingToPost.id, request.body);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "create:diary_entry",
    newEntry,
  );

  response.status(201).json(secureOutputValues);
}
