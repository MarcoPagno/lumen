import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import sessionModel from "models/session";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/user", () => {
  describe("Default user", () => {
    test("fails when session is already expired", async () => {
      jest.useFakeTimers({
        now: new Date(Date.now() - sessionModel.EXPIRATION_IN_MILLISECONDS),
      });

      const createdUser = await orchestrator.createUser({});
      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();

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

      //Set-Cookie assertions
      expect(response.headers.get(`set-cookie`)).toBe(
        `session_id=invalid; Max-Age=-1; Path=/; HttpOnly`,
      );
    });

    test("fails when session does not exist", async () => {
      const nonexistentToken =
        "522d532f09c413668a4f0bf0399137b1eb23bb65c5edadd148bb39993a4f7e0e28ccc9a15c61e95515c3477402e5dd83";
      const response = await fetch("http://localhost:3000/api/v1/user", {
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
      const createdUser = await orchestrator.createUser({});
      const session = await orchestrator.createSession(createdUser.id);

      const response = await fetch("http://localhost:3000/api/v1/user", {
        method: "GET",
        headers: {
          Cookie: `session_id=` + session.token,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        features: ["read:activation_token"],
        password: createdUser.password,
        created_at: createdUser.created_at.toISOString(),
        updated_at: createdUser.updated_at.toISOString(),
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
        `session_id=${renewedSessionObject.token}; Max-Age=${sessionModel.EXPIRATION_IN_MILLISECONDS / 1000}; Path=/; HttpOnly`,
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

      const createdUser = await orchestrator.createUser({});

      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();

      //almost ending
      expect(sessionObject.expires_at < new Date(Date.now() + 600)).toBe(true);

      const response = await fetch("http://localhost:3000/api/v1/user", {
        method: "GET",
        headers: {
          Cookie: `session_id=` + sessionObject.token,
        },
      });
      expect(response.status).toBe(200);

      const renewedSessionObject = await sessionModel.findValidSessionByToken(
        sessionObject.token,
      );

      //RENEWED
      expect(renewedSessionObject.expires_at > sessionObject.expires_at).toBe(
        true,
      );
      expect(renewedSessionObject.updated_at > sessionObject.updated_at).toBe(
        true,
      );

      //set-cookies assertions
      expect(response.headers.get(`set-cookie`)).toBe(
        `session_id=${renewedSessionObject.token}; Max-Age=${sessionModel.EXPIRATION_IN_MILLISECONDS / 1000}; Path=/; HttpOnly`,
      );

      expect(response.headers.get(`Cache-Control`)).toBe(
        "no-store, no-cache, max-age=0, must-revalidate",
      );
    });
  });
});
