import orchestrator from "tests/orchestrator.js";
import sessionModel from "models/session.js";

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

      const response = await fetch("http://localhost:3000/api/v1/sessions", {
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

      const newUser = await orchestrator.createUser({});
      const newSession = await orchestrator.createSession(newUser);

      jest.useRealTimers();

      const response = await fetch("http://localhost:3000/api/v1/sessions", {
        method: "DELETE",
        headers: {
          Cookie: `session_id=` + newSession.token,
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

    test("With valid session", async () => {
      const newUser = await orchestrator.createUser({});
      const sessionObject = await orchestrator.createSession(newUser);

      const responseDeleted = await fetch(
        "http://localhost:3000/api/v1/sessions",
        {
          method: "DELETE",
          headers: {
            Cookie: `session_id=` + sessionObject.token,
          },
        },
      );
      expect(responseDeleted.status).toBe(200);

      const responseDeletedBody = await responseDeleted.json();
      expect(responseDeletedBody).toEqual({
        id: sessionObject.id,
        token: sessionObject.token,
        user_id: newUser.id,
        created_at: sessionObject.created_at.toISOString(),
        expires_at: responseDeletedBody.expires_at,
        updated_at: responseDeletedBody.updated_at,
      });

      expect(
        responseDeletedBody.expires_at < sessionObject.expires_at.toISOString(),
      ).toBe(true);
      expect(
        responseDeletedBody.updated_at > sessionObject.updated_at.toISOString(),
      ).toBe(true);

      //Set-Cookie assertions
      expect(responseDeleted.headers.get(`set-cookie`)).toBe(
        `session_id=invalid; Max-Age=-1; Path=/; HttpOnly`,
      );

      const response = await fetch("http://localhost:3000/api/v1/user", {
        method: "GET",
        headers: {
          Cookie: `session_id=` + sessionObject.token,
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
