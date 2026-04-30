import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import sessionModel from "models/session";
import userModel from "models/user";

const router = createRouter();

router.get(getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const session = await sessionModel.findValidSessionByToken(
    request.cookies.session_id,
  );
  const userFound = await userModel.findUserById(session.user_id);
  await sessionModel.renew(session.id);

  await controller.setSessionCookie(session.token, response);

  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );

  return response.status(200).json(userFound);
}
