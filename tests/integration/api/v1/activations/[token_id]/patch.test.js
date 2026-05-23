import { version as uuidVersion } from "uuid";
import userModel from "models/user.js";
import sessionModel from "models/session.js";
import activationModel from "models/activation.js";
import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("PATCH /api/v1/activations/[token_id]", () => {
  describe("Anonymous user", () => {
    test("returns 404 when token does not exist", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/activations/883e22d2-c551-4ef3-b535-2321a98524fb`,
        {
          method: "PATCH",
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "Activation token not found or expired",
        action: "Register again to receive a new activation token",
        status_code: 404,
      });
    });

    test("returns 404 when token is expired", async () => {
      jest.useFakeTimers({
        now: new Date(Date.now() - sessionModel.EXPIRATION_IN_MILLISECONDS),
      });

      const createdUser = await orchestrator.createUser();
      const expiredActivationToken = await activationModel.create(createdUser);

      jest.useRealTimers();

      const response = await fetch(
        `${webserver.origin}/api/v1/activations/${expiredActivationToken.id}`,
        {
          method: "PATCH",
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "Activation token not found or expired",
        action: "Register again to receive a new activation token",
        status_code: 404,
      });
    });

    test("returns 404 when token has already been used", async () => {
      const createdUser = await orchestrator.createUser();
      const activationToken = await activationModel.create(createdUser);

      const response1 = await fetch(
        `${webserver.origin}/api/v1/activations/${activationToken.id}`,
        {
          method: "PATCH",
        },
      );
      expect(response1.status).toBe(200);

      const response = await fetch(
        `${webserver.origin}/api/v1/activations/${activationToken.id}`,
        {
          method: "PATCH",
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "Activation token not found or expired",
        action: "Register again to receive a new activation token",
        status_code: 404,
      });
    });

    test("activates account and returns 200 with valid token", async () => {
      const createdUser = await orchestrator.createUser();
      const activationToken = await activationModel.create(createdUser);

      const response = await fetch(
        `${webserver.origin}/api/v1/activations/${activationToken.id}`,
        {
          method: "PATCH",
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: activationToken.id,
        used_at: responseBody.used_at,
        user_id: activationToken.user_id,
        expires_at: activationToken.expires_at.toISOString(),
        created_at: activationToken.created_at.toISOString(),
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(uuidVersion(responseBody.user_id)).toBe(4);

      expect(Date.parse(responseBody.expires_at)).not.toBeNaN();
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
      expect(responseBody.updated_at > responseBody.created_at).toBe(true);

      const activatedUser = await userModel.findUserById(responseBody.user_id);
      expect(activatedUser.features).toEqual([
        "create:session",
        "read:session",
        "update:user:self",
      ]);
    });

    test("returns 403 when account is already activated", async () => {
      const createdUser = await orchestrator.createUser();
      await orchestrator.activateUser(createdUser);
      const activationToken = await activationModel.create(createdUser);

      const response = await fetch(
        `${webserver.origin}/api/v1/activations/${activationToken.id}`,
        {
          method: "PATCH",
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Activation tokens are no longer valid for this user",
        action: "Contact support if you need assistance",
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("returns 403 when user is already authenticated", async () => {
      const { session: user1SessionObject } =
        await orchestrator.createUserActivateAndReturnSession();

      const user2 = await orchestrator.createUser();
      const user2ActivationToken = await activationModel.create(user2);

      const response = await fetch(
        `${webserver.origin}/api/v1/activations/${user2ActivationToken.id}`,
        {
          method: "PATCH",
          headers: {
            Cookie: `session_id=${user1SessionObject.token}`,
          },
        },
      );
      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action: `Ensure the user has the required feature: "read:activation_token"`,
        status_code: 403,
      });
    });
  });
});
