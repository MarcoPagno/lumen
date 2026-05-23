import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/migrations", () => {
  describe("Anonymous user", () => {
    test("retrieving pending migrations", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/migrations`);
      expect(response.status).toBe(403);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action: 'Ensure the user has the required feature: "read:migration"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("retrieving pending migrations", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(`${webserver.origin}/api/v1/migrations`, {
        headers: {
          Cookie: `session_id=${session.token}`,
        },
      });
      expect(response.status).toBe(403);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action: 'Ensure the user has the required feature: "read:migration"',
        status_code: 403,
      });
    });
  });

  describe("Privileged user", () => {
    test("retrieving pending migrations with `read:migration` feature", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, ["read:migration"]);

      const response = await fetch(`${webserver.origin}/api/v1/migrations`, {
        headers: {
          Cookie: `session_id=${session.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(Array.isArray(responseBody)).toBe(true);
    });
  });
});
