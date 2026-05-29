import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

//get needs to be by slug
describe("GET /api/v1/system_activity_types/[slugOrId]", () => {
  describe("Anonymous user", () => {
    test("returns 403 when user are not logged", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types`,
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action:
          'Ensure the user has the required feature: "read:system_activity_type"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("returns system activity type when user are logged", async () => {
      const { session: sessionObj } =
        await orchestrator.createUserActivateAndReturnSession();

      const obj1 = await orchestrator.createSystemActivityType();
      await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types/${obj1.slug}`,
        {
          method: "GET",
          headers: {
            Cookie: `session_id=${sessionObj.token}`,
          },
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        slug: obj1.slug,
        name: obj1.name,
        category: obj1.category,
        color: obj1.color,
        is_default_active: obj1.is_default_active,
        frequency: obj1.frequency,
        expires_after_days: obj1.expires_after_days,
        source: obj1.source,
        source_url: obj1.source_url,
      });
    });
  });
});
