import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import user from "models/user.js";
import passwordModel from "models/password.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/users", () => {
  describe("Anonymous user", () => {
    test("creates user with valid and unique data", async () => {
      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "test",
          email: "test@gmail.com",
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

    test("fails when username is already in use", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicated",
          email: "duplicatedUsername@gmail.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "Duplicated",
          email: "duplicatedUsername2@gmail.com",
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

    test("fails when email is already in use", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicatedEmail1",
          email: "duplicated@gmail.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicatedEmail2",
          email: "Duplicated@gmail.com",
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
      const user1 = await orchestrator.createUser();
      await orchestrator.activateUser(user1);
      const user1SessionObject = await orchestrator.createSession(user1);

      const user2Response = await fetch(`http://localhost:3000/api/v1/users`, {
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
