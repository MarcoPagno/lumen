import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import sessionModel from "models/session.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/user", () => {
  describe("Anonymous user", () => {
    test("Retrieving the endpoint", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/user`);

      expect(response.status).toBe(403);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action: 'Ensure the user has the required feature: "read:session"',
        status_code: 403,
      });
    });
  });

  describe("Authenticated user", () => {
    test("fails when session is already expired", async () => {
      jest.useFakeTimers({
        now: new Date(Date.now() - sessionModel.EXPIRATION_IN_MILLISECONDS),
      });

      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      jest.useRealTimers();

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

      //Set-Cookie assertions
      expect(response.headers.get(`set-cookie`)).toBe(
        `session_id=invalid; Max-Age=-1; Path=/; HttpOnly`,
      );
    });

    test("fails when session does not exist", async () => {
      const nonexistentToken =
        "522d532f09c413668a4f0bf0399137b1eb23bb65c5edadd148bb39993a4f7e0e28ccc9a15c61e95515c3477402e5dd83";
      const response = await fetch(`${webserver.origin}/api/v1/user`, {
        method: "GET",
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

      //Set-Cookie assertions
      expect(response.headers.get(`set-cookie`)).toBe(
        `session_id=invalid; Max-Age=-1; Path=/; HttpOnly`,
      );
    });

    test("successfully when sends session and receives user", async () => {
      const { session, user } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(`${webserver.origin}/api/v1/user`, {
        method: "GET",
        headers: {
          Cookie: `session_id=` + session.token,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: user.id,
        username: user.username,
        email: user.email,
        features: [
          "create:session",
          "read:session",
          "update:user:self",
          "create:topic",
          "read:topic:self",
          "create:review",
          "read:queue:self",
          "read:review_session:self",
        ],
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const renewedSessionObject = await sessionModel.findValidSessionByToken(
        session.token,
      );

      expect(renewedSessionObject.expires_at > session.expires_at).toBe(true);
      expect(renewedSessionObject.updated_at > session.updated_at).toBe(true);

      //set-cookies assertions
      expect(response.headers.get(`set-cookie`)).toBe(
        `session_id=${renewedSessionObject.token}; Max-Age=${sessionModel.EXPIRATION_IN_MILLISECONDS / 1000}; Path=/; HttpOnly; SameSite=Lax`,
      );

      expect(response.headers.get(`Cache-Control`)).toBe(
        "no-store, no-cache, max-age=0, must-revalidate",
      );
    });

    test("successfully with last second expiring session", async () => {
      jest.useFakeTimers({
        now: new Date(
          Date.now() - (sessionModel.EXPIRATION_IN_MILLISECONDS - 600),
        ),
      });

      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      jest.useRealTimers();

      //almost ending
      expect(session.expires_at < new Date(Date.now() + 600)).toBe(true);

      const response = await fetch(`${webserver.origin}/api/v1/user`, {
        method: "GET",
        headers: {
          Cookie: `session_id=` + session.token,
        },
      });
      expect(response.status).toBe(200);

      const renewedSession = await sessionModel.findValidSessionByToken(
        session.token,
      );

      //RENEWED
      expect(renewedSession.expires_at > session.expires_at).toBe(true);
      expect(renewedSession.updated_at > session.updated_at).toBe(true);

      //set-cookies assertions
      expect(response.headers.get(`set-cookie`)).toBe(
        `session_id=${renewedSession.token}; Max-Age=${sessionModel.EXPIRATION_IN_MILLISECONDS / 1000}; Path=/; HttpOnly; SameSite=Lax`,
      );

      expect(response.headers.get(`Cache-Control`)).toBe(
        "no-store, no-cache, max-age=0, must-revalidate",
      );
    });
  });
});
