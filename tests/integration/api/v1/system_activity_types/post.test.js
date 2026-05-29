import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/system_activity_types", () => {
  describe("Anonymous user", () => {
    test("returns 403 when user are not logged", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: "test-fails",
            name: "testfails",
            category: "documento",
            color: "#fff",
            is_default_active: true,
            frequency: "on_publish",
            expires_after_days: 3,
            source: "rss",
            source_url: "http://prayerapi.com/api/rss",
          }),
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action:
          'Ensure the user has the required feature: "create:system_activity_type"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("returns 403 when user does not have the permission", async () => {
      const { session: sessionObj } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types`,
        {
          method: "POST",
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
          'Ensure the user has the required feature: "create:system_activity_type"',
        status_code: 403,
      });
    });
  });

  describe("Privileged user", () => {
    test("creates system activity item when user are logged", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "create:system_activity_type",
      ]);

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            slug: "test-success",
            name: "testsuccess",
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
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        slug: "test-success",
        name: "testsuccess",
        category: "documento",
        color: "#fff",
        is_default_active: true,
        frequency: "on_publish",
        expires_after_days: 3,
        source: "rss",
        source_url: "https://pokeapi.co/api/v2/",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
    });

    test("returns 400 when `slug` already exists", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "create:system_activity_type",
      ]);

      await fetch(`${webserver.origin}/api/v1/system_activity_types`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObj.token}`,
        },
        body: JSON.stringify({
          slug: "test-slug-repeat",
          name: "testslugrepeat1",
          category: "documento",
          color: "#fff",
          is_default_active: true,
          frequency: "on_publish",
          expires_after_days: 3,
          source: "rss",
          source_url: "https://pokeapi.co",
        }),
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            slug: "test-slug-repeat",
            name: "testslugrepeat2",
            category: "documento",
            color: "#fff",
            is_default_active: true,
            frequency: "on_publish",
            expires_after_days: 3,
            source: "rss",
            source_url: "https://pokeapi.co",
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
        "create:system_activity_type",
      ]);

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_types`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            slug: "test-url",
            name: "testurl",
            category: "documento",
            color: "#fff",
            is_default_active: true,
            frequency: "on_publish",
            expires_after_days: 3,
            source: "rss",
            source_url: "https://testurl.com",
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
  });
});
