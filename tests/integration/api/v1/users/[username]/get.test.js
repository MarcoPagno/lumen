import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/users/[username]", () => {
  describe("Anonymous user", () => {
    test("returns user when `username` matches exactly", async () => {
      await orchestrator.createUser({
        username: "userTest",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/users/userTest`,
        {
          method: "GET",
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "userTest",
        features: ["read:activation_token"],
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
    });

    test("returns user when `username` matches ignoring case", async () => {
      await orchestrator.createUser({
        username: "userTestDifferent",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/users/userTestDifferent`,
        {
          method: "GET",
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "userTestDifferent",
        features: ["read:activation_token"],
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
    });

    test("returns 404 when `username` does not exist", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/users/testNotFoundUser`,
        {
          method: "GET",
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "User not found",
        action: "Check for typos or verify the identifier",
        status_code: 404,
      });
    });
  });
});
