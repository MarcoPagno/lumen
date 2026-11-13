import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import diaryModel from "models/diary.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:diary_entry:self"), patchHandler)
  .delete(controller.canRequest("delete:diary_entry:self"), deleteHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;

  const updatedEntry = await diaryModel.update(
    request.query.entry_id,
    userTryingToPatch.id,
    request.body,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPatch,
    "update:diary_entry:self",
    updatedEntry,
  );

  response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;

  const deletedEntry = await diaryModel.remove(
    request.query.entry_id,
    userTryingToDelete.id,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToDelete,
    "delete:diary_entry:self",
    deletedEntry,
  );

  response.status(200).json(secureOutputValues);
}
