import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import sessionModel from "models/session.js";
import authenticationModel from "models/authentication.js";

const router = createRouter();

router.post(postHandler);
router.delete(deleteHandler);

export default router.handler(controller.errorHandlers);

async function postHandler(request, response) {
  const authenticatedUser = await authenticationModel.getAuthenticatedUser(
    request.body.email,
    request.body.password,
  );

  const newSession = await sessionModel.create(authenticatedUser.id);

  controller.setSessionCookie(newSession.token, response);

  return response.status(201).json(newSession);
}

async function deleteHandler(request, response) {
  const session = await sessionModel.findValidSessionByToken(
    request.cookies.session_id,
  );

  const expiredSession = await sessionModel.expireById(session.id);

  controller.clearSessionCookie(response);

  return response.status(200).json(expiredSession);
}
