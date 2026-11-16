import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import readingModel from "models/reading.js";
import readingFavoriteModel from "models/reading-favorite.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:reading"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const readingId = request.query.reading_id;

  const reading = await readingModel.findById(readingId);
  const [content, isFavorite] = await Promise.all([
    readingModel.getContent(reading),
    readingFavoriteModel.isFavorite(userTryingToGet.id, reading),
  ]);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:reading",
    { ...reading, content, is_favorite: isFavorite },
  );

  response.status(200).json(secureOutputValues);
}
