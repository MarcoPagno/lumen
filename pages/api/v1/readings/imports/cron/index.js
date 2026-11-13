import { createRouter } from "next-connect";
import controller from "infra/controller.js";
import { UnauthorizedError } from "infra/errors.js";
import readingImportModel from "models/reading-import.js";

export const config = {
  maxDuration: 300,
};

export default createRouter().get(getHandler).handler(controller.errorHandlers);

async function getHandler(request, response) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    throw new UnauthorizedError({
      message: "Invalid cron credentials",
      action: "Provide the CRON_SECRET in the Authorization header",
    });
  }

  const result = await readingImportModel.importAll();
  response.status(200).json(result);
}
