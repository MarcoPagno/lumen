import { createRouter } from "next-connect";
import database from "infra/database.js";
import controller from "infra/controller.js";

const router = createRouter();

router.get(getHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
  const databaseName = process.env.POSTGRES_DB;
  const postgresversion = await database.query("SHOW server_version;");
  const maxconnections = await database.query("SHOW max_connections;");
  const usedconnections = await database.query({
    text: "SELECT COUNT(*)::int FROM pg_stat_activity WHERE datname = $1;",
    values: [databaseName],
  });

  const updatedAt = new Date().toISOString();

  response.status(200).json({
    updated_at: updatedAt,
    dependencies: {
      database: {
        version: postgresversion.rows[0].server_version,
        max_connections: parseInt(maxconnections.rows[0].max_connections),
        opened_connections: usedconnections.rows[0].count,
      },
    },
  });
}
