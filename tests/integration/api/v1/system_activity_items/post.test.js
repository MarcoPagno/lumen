import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/system_activity_items", () => {
  describe("Anonymous user", () => {
    test("returns 403 when user are not logged", async () => {
      const activityType = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            system_activity_item_id: activityType.id,
            title: "unloged-error",
            subtitle: "unloged-error-subtitle",
            url: "https://google.com",
            published_at: "2026-05-30 01:10:32.288205+00",
          }),
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action:
          'Ensure the user has the required feature: "create:system_activity_item"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("returns 403 when user does not have the permission", async () => {
      const { session: sessionObj } =
        await orchestrator.createUserActivateAndReturnSession();

      const activityType = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_item_id: activityType.id,
            title: "unauthenticated-error",
            subtitle: "unauthenticated-error-subtitle",
            url: "https://google.com",
            published_at: "2026-05-30 01:10:32.288205+00",
          }),
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action:
          'Ensure the user has the required feature: "create:system_activity_item"',
        status_code: 403,
      });
    });
  });

  describe("Privileged user", () => {
    test("returns 404 when `system_activity_type_id` is not found", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "create:system_activity_item",
      ]);

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_type_id: "123e4567-e89b-12d3-a456-426614174000",
            title: "system_activity_item_id-notfound",
            subtitle: "system_activity_item_id-notfound-subtitle",
            url: "https://google.com",
            published_at: "2026-05-30T01:10:32.288Z",
          }),
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "system_activity_type not found",
        action: "Verify the provided ID and try again",
        status_code: 404,
      });
    });

    test("returns 400 when `title` already exists", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "create:system_activity_item",
      ]);

      const activityType = await orchestrator.createSystemActivityType();

      await fetch(`${webserver.origin}/api/v1/system_activity_items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionObj.token}`,
        },
        body: JSON.stringify({
          system_activity_type_id: activityType.id,
          title: "title-exists-error",
          subtitle: "title-exists-error-subtitle1",
          url: "https://google.com",
          published_at: "2026-05-30T01:10:32.288Z",
        }),
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_type_id: activityType.id,
            title: "title-exists-error",
            subtitle: "title-exists-error-subtitle2",
            url: "https://google.com",
            published_at: "2026-05-30 01:10:32.288205+00",
          }),
        },
      );
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Title already in use",
        action: "Choose a different title",
        status_code: 400,
      });
    });

    test("returns 400 when `published_at` is not in timestampz format", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "create:system_activity_item",
      ]);

      const activityType = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_type_id: activityType.id,
            title: "timestampz-error",
            subtitle: "timestampz-error-subtitle",
            url: "https://google.com",
            published_at: "30/05/2026",
          }),
        },
      );
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "published_at date is at wrong format",
        action: "The format needs to be timestamptz(2000-12-31T01:00:00.000Z)",
        status_code: 400,
      });
    });

    test("returns 404 when `url` is invalid", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "create:system_activity_item",
      ]);

      const activityType = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_type_id: activityType.id,
            title: "url-error",
            subtitle: "url-error-subtitle",
            url: "https://naoexisto.com",
            published_at: "2026-05-30T01:10:32.288Z",
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

    test("creates system activity item when user are logged", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "create:system_activity_item",
      ]);

      const activityType = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_type_id: activityType.id,
            title: "privileged-success",
            subtitle: "privileged-success-subtitle",
            url: "https://google.com",
            published_at: "2026-05-30T01:10:32.288Z",
          }),
        },
      );
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        system_activity_type_id: activityType.id,
        title: "privileged-success",
        subtitle: "privileged-success-subtitle",
        url: "https://google.com",
        published_at: "2026-05-30T01:10:32.288Z",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
    });
  });
});
