import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

//patch needs to be by id
describe("PATCH /api/v1/system_activity_items/[id]", () => {
  describe("Anonymous user", () => {
    test("returns 403 when user are not logged", async () => {
      const typeObj = await orchestrator.createSystemActivityType();
      const item = await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items/${item.id}`,
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
          'Ensure the user has the required feature: "update:system_activity_item"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("returns 403 when user does not have the permission", async () => {
      const { session: sessionObj } =
        await orchestrator.createUserActivateAndReturnSession();

      const typeObj = await orchestrator.createSystemActivityType();
      const item = await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action:
          'Ensure the user has the required feature: "update:system_activity_item"',
        status_code: 403,
      });
    });
  });

  describe("Privileged user", () => {
    test("returns 400 when `title` already exists", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "update:system_activity_item",
      ]);

      const typeObj = await orchestrator.createSystemActivityType();
      await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
        title: "item-exists-error",
      });
      const item = await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            title: "item-exists-error",
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

    test("returns 404 when `system_activity_type_id` is not found", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "update:system_activity_item",
      ]);

      const typeObj = await orchestrator.createSystemActivityType();
      await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });
      const item = await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_type_id: "123e4567-e89b-12d3-a456-426614174000",
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

    test("returns 400 when `published_at` is not in timestampz format", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "update:system_activity_item",
      ]);

      const typeObj = await orchestrator.createSystemActivityType();
      await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });
      const item = await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            published_at: "22/11/2026",
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
        "update:system_activity_item",
      ]);

      const typeObj = await orchestrator.createSystemActivityType();
      await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });
      const item = await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            url: "https://naoexisto.com",
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

    test("returns system activity item when user are logged", async () => {
      const { session: sessionObj, user } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.addFeaturesToUser(user, [
        "update:system_activity_item",
      ]);

      const typeObj = await orchestrator.createSystemActivityType();
      await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });
      const item = await orchestrator.createSystemActivityItem({
        system_activity_type_id: typeObj.id,
      });

      const typeObj2 = await orchestrator.createSystemActivityType();

      const response = await fetch(
        `${webserver.origin}/api/v1/system_activity_items/${item.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionObj.token}`,
          },
          body: JSON.stringify({
            system_activity_type_id: typeObj2.id,
            title: "Item Update Success",
            subtitle: "item-update-success",
            url: "https://facebook.com",
            published_at: "2026-05-30T01:10:32.288Z",
          }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        system_activity_type_id: typeObj2.id,
        title: "Item Update Success",
        subtitle: "item-update-success",
        url: "https://facebook.com",
        published_at: "2026-05-30T01:10:32.288Z",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
    });
  });
});
