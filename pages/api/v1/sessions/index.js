import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import sessionModel from "models/session.js";
import authenticationModel from "models/authentication.js";
import authorizationModel from "models/authorization.js";
import { ForbiddenError } from "infra/errors.js";

const router = createRouter();

router.use(controller.injectAnonymousOrUser);
router.post(controller.canRequest("create:session"), postHandler);
router.delete(deleteHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const authenticatedUser = await authenticationModel.getAuthenticatedUser(
    request.body.email,
    request.body.password,
  );

  if (!authorizationModel.can(authenticatedUser, "create:session")) {
    throw new ForbiddenError({
      message: "Insufficient permissions to create a session",
      action: "Contact support if you believe this is an error",
    });
  }

  const newSession = await sessionModel.create(authenticatedUser.id);

  controller.setSessionCookie(newSession.token, response);

  const secureOutputValues = authorizationModel.filterOutput(
    authenticatedUser,
    "read:session",
    newSession,
  );

  response.status(201).json(secureOutputValues);
}

async function deleteHandler(request, response) {
  const userTryingToDelete = request.context.user;
  const session = await sessionModel.findValidSessionByToken(
    request.cookies.session_id,
  );

  const expiredSession = await sessionModel.expireById(session.id);

  controller.clearSessionCookie(response);

  const secureOutputValues = authorizationModel.filterOutput(
    userTryingToDelete,
    "read:session",
    expiredSession,
  );

  response.status(200).json(secureOutputValues);
}
