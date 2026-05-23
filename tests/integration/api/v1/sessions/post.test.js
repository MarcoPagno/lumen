import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import sessionModel from "models/session.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("POST /api/v1/sessions", () => {
  describe("Anonymous user", () => {
    test("fails with incorrect `email` but correct `password`", async () => {
      await orchestrator.createUser({
        password: "correctPassword",
      });

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "wrong.email@email.com",
          password: "correctPassword",
        }),
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Invalid authentication credentials",
        action: "Verify the provided credentials and try again",
        status_code: 401,
      });
    });

    test("fails with correct `email` but incorrect `password`", async () => {
      await orchestrator.createUser({
        email: "correctEmail@email.com",
      });

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "correctEmail@email.com",
          password: "incorrectPassword",
        }),
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Invalid authentication credentials",
        action: "Verify the provided credentials and try again",
        status_code: 401,
      });
    });

    test("fails with incorrect `email` and incorrect `password`", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "incorrectEmail@email.com",
          password: "incorrectPassword",
        }),
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Invalid authentication credentials",
        action: "Verify the provided credentials and try again",
        status_code: 401,
      });
    });

    test("creates session with valid credentials", async () => {
      const newSessionUser = await orchestrator.createUser({
        email: "allCorrect@email.com",
        password: "allCorrect123",
      });

      const activatedAccount = await orchestrator.activateUser(newSessionUser);

      expect(activatedAccount.features).toEqual([
        "create:session",
        "read:session",
        "update:user",
      ]);

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "AllCorrect@email.com",
          password: "allCorrect123",
        }),
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        token: responseBody.token,
        user_id: newSessionUser.id,
        expires_at: responseBody.expires_at,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.expires_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const expiresAt = new Date(responseBody.expires_at);
      const createdAt = new Date(responseBody.created_at);

      expect(expiresAt >= createdAt).toBe(true);

      const actualLifetimeInMilliseconds = expiresAt - createdAt;
      const lifetimeDifferenceInMilliseconds =
        sessionModel.EXPIRATION_IN_MILLISECONDS - actualLifetimeInMilliseconds;

      expect(lifetimeDifferenceInMilliseconds).toBeLessThanOrEqual(5000);

      expect(response.headers.get(`set-cookie`)).toBe(
        `session_id=${responseBody.token}; Max-Age=${sessionModel.EXPIRATION_IN_MILLISECONDS / 1000}; Path=/; HttpOnly; SameSite=Lax`,
      );
    });
  });
});
