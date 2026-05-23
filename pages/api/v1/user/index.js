import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import sessionModel from "models/session.js";
import userModel from "models/user.js";
import authorizationModel from "models/authorization.js";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.canRequest("read:session"), getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const session = await sessionModel.findValidSessionByToken(
    request.cookies.session_id,
  );
  const userFound = await userModel.findUserById(session.user_id);
  await sessionModel.renew(session.id);

  controller.setSessionCookie(session.token, response);

  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToGet,
    "read:user:self",
    userFound,
  );

  response.status(200).json(secureOutputValues);
}
