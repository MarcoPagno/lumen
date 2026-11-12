import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import bookModel from "models/book.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .patch(controller.canRequest("update:book:self"), patchHandler)
  .handler(controller.errorHandlers);

async function patchHandler(request, response) {
  const userTryingToPatch = request.context.user;
  const bookId = request.query.book_id;

  const updatedBook = await bookModel.update(
    bookId,
    userTryingToPatch.id,
    request.body,
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPatch,
    "update:book:self",
    updatedBook,
  );

  response.status(200).json(secureOutputValues);
}
