import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import bookModel from "models/book.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:book:self"), getHandler)
  .post(controller.canRequest("create:book"), postHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const books = await bookModel.findAllByUser(userTryingToGet.id);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:book:self",
    books,
  );

  response.status(200).json(secureOutputValues);
}

async function postHandler(request, response) {
  const userTryingToPost = request.context.user;
  const newBook = await bookModel.create(userTryingToPost.id, request.body);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToPost,
    "create:book",
    newBook,
  );

  response.status(201).json(secureOutputValues);
}
