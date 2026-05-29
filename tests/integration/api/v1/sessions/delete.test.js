import orchestrator from "tests/orchestrator.js";
import sessionModel from "models/session.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("DELETE /api/v1/sessions", () => {
  describe("Default user", () => {
    test("fails when session does not exist", async () => {
      const nonexistentToken =
        "b85c1ca401abd3dff6ae4c5d426163d434ffbd6197af97d1d0a804afcae9402b755048f63d41f1e3961b744fdea560dd";

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "DELETE",
        headers: {
          Cookie: `session_id=` + nonexistentToken,
        },
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Invalid or expired session",
        action: "Authenticate and try again",
        status_code: 401,
      });
    });

    test("fails when session is already expired", async () => {
      jest.useFakeTimers({
        now: new Date(Date.now() - sessionModel.EXPIRATION_IN_MILLISECONDS),
      });

      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      jest.useRealTimers();

      const response = await fetch(`${webserver.origin}/api/v1/sessions`, {
        method: "DELETE",
        headers: {
          Cookie: `session_id=` + session.token,
        },
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Invalid or expired session",
        action: "Authenticate and try again",
        status_code: 401,
      });
    });

    test("delete session when user has a valid session", async () => {
      const { session, user } =
        await orchestrator.createUserActivateAndReturnSession();

      const responseDeleted = await fetch(
        `${webserver.origin}/api/v1/sessions`,
        {
          method: "DELETE",
          headers: {
            Cookie: `session_id=` + session.token,
          },
        },
      );
      expect(responseDeleted.status).toBe(200);

      const responseDeletedBody = await responseDeleted.json();
      expect(responseDeletedBody).toEqual({
        id: session.id,
        token: session.token,
        user_id: user.id,
        created_at: session.created_at.toISOString(),
        expires_at: responseDeletedBody.expires_at,
        updated_at: responseDeletedBody.updated_at,
      });

      expect(
        responseDeletedBody.expires_at < session.expires_at.toISOString(),
      ).toBe(true);
      expect(
        responseDeletedBody.updated_at > session.updated_at.toISOString(),
      ).toBe(true);

      //Set-Cookie assertions
      expect(responseDeleted.headers.get(`set-cookie`)).toBe(
        `session_id=invalid; Max-Age=-1; Path=/; HttpOnly`,
      );

      const response = await fetch(`${webserver.origin}/api/v1/user`, {
        method: "GET",
        headers: {
          Cookie: `session_id=` + session.token,
        },
      });
      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError",
        message: "Invalid or expired session",
        action: "Authenticate and try again",
        status_code: 401,
      });
    });
  });
});
