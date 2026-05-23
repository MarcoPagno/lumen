import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/migrations", () => {
  describe("Anonymous user", () => {
    test("posting pending migrations", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/migrations`, {
        method: "POST",
      });
      expect(response.status).toBe(403);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action: 'Ensure the user has the required feature: "create:migration"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("posting pending migrations", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(`${webserver.origin}/api/v1/migrations`, {
        method: "POST",
        headers: {
          Cookie: `session_id=${session.token}`,
        },
      });
      expect(response.status).toBe(403);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action: 'Ensure the user has the required feature: "create:migration"',
        status_code: 403,
      });
    });
  });

  describe("Privileged user", () => {
    test("posting pending migrations with `create:migration` feature", async () => {
      const { session, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, ["create:migration"]);

      const response = await fetch(`${webserver.origin}/api/v1/migrations`, {
        method: "POST",
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
