import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("GET /api/v1/status", () => {
  describe("Anonymous user", () => {
    test("return current system status", async () => {
      const response = await fetch("http://localhost:3000/api/v1/status");
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        updated_at: responseBody.updated_at,
        dependencies: {
          database: {
            max_connections: 100,
            opened_connections: 1,
          },
        },
      });

      expect(responseBody.updated_at).toBeDefined();

      const parsedUpdatedAt = new Date(responseBody.updated_at).toISOString();
      expect(responseBody.updated_at).toEqual(parsedUpdatedAt);
    });
  });

  describe("Privileged user", () => {
    test("return current system status", async () => {
      const privilegedUser = await orchestrator.createUser();

      const activatedPrivilegedUser =
        await orchestrator.activateUser(privilegedUser);

      await orchestrator.addFeaturesToUser(privilegedUser, ["read:status:all"]);

      const privilegedUserSession = await orchestrator.createSession(
        activatedPrivilegedUser,
      );

      const response = await fetch("http://localhost:3000/api/v1/status", {
        method: "GET",
        headers: {
          Cookie: `session_id=${privilegedUserSession.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        updated_at: responseBody.updated_at,
        dependencies: {
          database: {
            version: "18.4",
            max_connections: 100,
            opened_connections: 1,
          },
        },
      });

      expect(responseBody.updated_at).toBeDefined();

      const parsedUpdatedAt = new Date(responseBody.updated_at).toISOString();
      expect(responseBody.updated_at).toEqual(parsedUpdatedAt);
    });
  });
});
