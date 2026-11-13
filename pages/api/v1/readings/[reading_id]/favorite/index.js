import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingFavoriteModel from "models/reading-favorite.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .put(controller.canRequest("update:reading_favorite:self"), putHandler)
  .delete(controller.canRequest("update:reading_favorite:self"), deleteHandler)
  .handler(controller.errorHandlers);

async function putHandler(request, response) {
  const userTryingToFavorite = request.context.user;
  const favorite = await readingFavoriteModel.add(
    userTryingToFavorite.id,
    request.query.reading_id,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToFavorite,
    "update:reading_favorite:self",
    favorite,
  );

  response.status(200).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToUnfavorite = request.context.user;
  const favorite = await readingFavoriteModel.remove(
    userTryingToUnfavorite.id,
    request.query.reading_id,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToUnfavorite,
    "update:reading_favorite:self",
    favorite,
  );

  response.status(200).json(secureOutputValues);
}
