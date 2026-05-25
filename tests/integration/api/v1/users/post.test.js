import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import user from "models/user.js";
import passwordModel from "models/password.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/users", () => {
  describe("Anonymous user", () => {
    test("creates user with valid and unique data", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "test",
          email: "test@email.com",
          password: "password123",
        }),
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "test",
        features: ["read:activation_token"],
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const userInDatabase = await user.findUserByUsername("test");
      const correctPasswordMatch = await passwordModel.compare(
        "password123",
        userInDatabase.password,
      );

      expect(correctPasswordMatch).toBe(true);

      const incorrectPasswordMatch = await passwordModel.compare(
        "password124",
        userInDatabase.password,
      );
      expect(incorrectPasswordMatch).toBe(false);
    });

    test("fails when username is too short", async () => {
      const responseUsername = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "us",
          email: "usernameWrong@email.com",
          password: "password123",
        }),
      });
      expect(responseUsername.status).toBe(400);

      const responseUsernameBody = await responseUsername.json();
      expect(responseUsernameBody).toEqual({
        name: "ValidationError",
        message: "Username must be between 3 and 30 characters",
        action: "Choose a username with the correct length",
        status_code: 400,
      });
    });

    test("fails when username is too long", async () => {
      const responseUsername1 = await fetch(
        `${webserver.origin}/api/v1/users`,
        {
          method: "POST",
          type: "application/json",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: "usernameWrongCauseItsToooooooBig",
            email: "usernameWrong@email.com",
            password: "password123",
          }),
        },
      );
      expect(responseUsername1.status).toBe(400);

      const responseUsername1Body = await responseUsername1.json();
      expect(responseUsername1Body).toEqual({
        name: "ValidationError",
        message: "Username must be between 3 and 30 characters",
        action: "Choose a username with the correct length",
        status_code: 400,
      });
    });

    test("fails when username has special characters", async () => {
      const responseUsername2 = await fetch(
        `${webserver.origin}/api/v1/users`,
        {
          method: "POST",
          type: "application/json",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: "usernameWrongCauseHas@",
            email: "usernameWrong@email.com",
            password: "password123",
          }),
        },
      );
      expect(responseUsername2.status).toBe(400);

      const responseUsername2Body = await responseUsername2.json();
      expect(responseUsername2Body).toEqual({
        name: "ValidationError",
        message: "Username can only contain letters and numbers",
        action: "Remove any special characters from the username",
        status_code: 400,
      });
    });

    test("fails when email format is invalid", async () => {
      const responseEmail = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "emailFormatWrong",
          email: "emailFormatWrongemail.com",
          password: "password123",
        }),
      });
      expect(responseEmail.status).toBe(400);

      const responseEmailBody = await responseEmail.json();
      expect(responseEmailBody).toEqual({
        name: "ValidationError",
        message: "Email format is wrong",
        action: "Send a valid email",
        status_code: 400,
      });
    });

    test("fails when password is too short", async () => {
      const responsePassword = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "passwordFormatWrong",
          email: "passwordFormatWrong@email.com",
          password: "paswo",
        }),
      });
      expect(responsePassword.status).toBe(400);

      const responsePasswordBody = await responsePassword.json();
      expect(responsePasswordBody).toEqual({
        name: "ValidationError",
        message: "Password must be between 6 and 72 characters",
        action: "Choose a password with the correct length",
        status_code: 400,
      });
    });

    test("fails when password is too long", async () => {
      const responsePassword1 = await fetch(
        `${webserver.origin}/api/v1/users`,
        {
          method: "POST",
          type: "application/json",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: "passwordFormatWrong",
            email: "passwordFormatWrong@email.com",
            password:
              "passwordErrorCauseItsTooBigpasswordErrorCauseItsTooBigpasswordErrorCauseItsTooBig",
          }),
        },
      );
      expect(responsePassword1.status).toBe(400);

      const responsePassword1Body = await responsePassword1.json();
      expect(responsePassword1Body).toEqual({
        name: "ValidationError",
        message: "Password must be between 6 and 72 characters",
        action: "Choose a password with the correct length",
        status_code: 400,
      });
    });

    test("fails when `username` is already in use", async () => {
      const response1 = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicated",
          email: "duplicatedUsername@email.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "Duplicated",
          email: "duplicatedUsername2@email.com",
          password: "password123",
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Username already in use",
        action: "Choose a different username",
        status_code: 400,
      });
    });

    test("fails when `email` is already in use", async () => {
      const response1 = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicatedEmail1",
          email: "duplicated@email.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicatedEmail2",
          email: "Duplicated@email.com",
          password: "password123",
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Email already in use",
        action: "Use a different email address",
        status_code: 400,
      });
    });
  });

  describe("Authenticated user", () => {
    test("receives 403 while logged", async () => {
      const { session: user1SessionObject } =
        await orchestrator.createUserActivateAndReturnSession();

      const user2Response = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${user1SessionObject.token}`,
        },
        body: JSON.stringify({
          username: "userLogged",
          email: "userLogged@email.com",
          password: "password123",
        }),
      });

      expect(user2Response.status).toBe(403);

      const user2ResponseBody = await user2Response.json();

      expect(user2ResponseBody).toEqual({
        name: "ForbiddenError",
        message: "Insufficient permissions to perform this action",
        action: 'Ensure the user has the required feature: "create:user"',
        status_code: 403,
      });
    });
  });
});
