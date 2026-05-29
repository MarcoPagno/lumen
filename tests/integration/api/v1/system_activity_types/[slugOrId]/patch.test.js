import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

//patch needs to be by id
describe("PATCH /api/v1/system_activity_types/[slugOrId]", () => {
  describe("Anonymous user", () => {
    test("returns 403 when user are not logged", async () => {
      const obj = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types/${obj.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action:
          'Ensure the user has the required feature: "update:system_activity_type"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("returns 403 when user does not have the permission", async () => {
      const { session: sessionObj } =
        await orchestrator.createUserActivateAndReturnSession();

      const obj = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types/${obj.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            slug: "test-unauthorized",
            name: "testUnauthorized",
            category: "documento",
            color: "#fff",
            is_default_active: true,
            frequency: "on_publish",
            expires_after_days: 3,
            source: "rss",
            source_url: "https://pokeapi.co/api/v2/",
          }),
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action:
          'Ensure the user has the required feature: "update:system_activity_type"',
        status_code: 403,
      });
    });
  });

  describe("Privileged user", () => {
    test("returns 400 when `slug` already exists", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "update:system_activity_type",
      ]);

      await orchestrator.createSystemActivityType({ slug: "repeated-slug" });
      const obj = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types/${obj.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            slug: "repeated-slug",
          }),
        },
      );
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Slug already in use",
        action: "Use a different slug",
        status_code: 400,
      });
    });

    test("returns 404 when `source_url` is invalid", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "update:system_activity_type",
      ]);

      const obj = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types/${obj.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            slug: "test-updated",
            name: "Test Updated",
            source: "rss",
            source_url: "https://google.m",
          }),
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "NotFoundError",
        message:
          "The endpoint could not be reached or returned an invalid response",
        action: "Verify the URL, ensure the endpoint is active, and try again",
        status_code: 404,
      });
    });

    test("returns system activity type when user are logged", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "update:system_activity_type",
      ]);

      const obj = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types/${obj.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            slug: "test-updated",
            name: "Test Updated",
            source: "rss",
            source_url: "https://google.com",
          }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        slug: "test-updated",
        name: "Test Updated",
        category: obj.category,
        color: obj.color,
        is_default_active: obj.is_default_active,
        frequency: obj.frequency,
        expires_after_days: obj.expires_after_days,
        source: obj.source,
        source_url: obj.source_url,
      });
    });
  });
});
